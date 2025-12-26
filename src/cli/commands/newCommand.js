const inquirerModule = require('inquirer');
const inquirer = inquirerModule.default || inquirerModule;
const MaxLengthInputPrompt = require('inquirer-maxlength-input-prompt');
const chalk = require('chalk');

// Registrar el prompt personalizado para limitar la longitud del input
inquirer.registerPrompt('maxlength-input', MaxLengthInputPrompt);
const { DEFAULT_BRANCH_TYPES } = require('../constants/branchTypes');
const { resolveUserAlias, setStoredAlias } = require('../../config/userConfig');
const { createBranch, pushBranch } = require('../../git/gitService');
const { formatBranchName, MAX_SEGMENT_LENGTH } = require('../utils/branchName');
const { slugifySegment } = require('../utils/textHelpers');
const { getEffectiveAzureConfig, hasAzureCredentials } = require('../../config/azureConfig');
const { fetchAssignedWorkItems, inferBranchTypeFromWorkItem } = require('../../integrations/azureDevOpsService');

/**
 * Punto de entrada para la creación de ramas.
 * Delega en el flujo interactivo o directo según las opciones.
 * @param {Object} options - Opciones recibidas desde la CLI (type, desc, interactive, etc.)
 */
async function createNewBranch(options = {}) {
  // commander pasa interactive: false si se usa --no-interactive
  if (options.interactive === false) {
    return createNewBranchNonInteractive(options);
  }
  return createNewBranchInteractive(options);
}

/**
 * Crea una rama directamente sin preguntar al usuario, ideal para scripts o usuarios avanzados.
 * @param {Object} params
 * @param {string} params.type - Tipo de rama (feature, bugfix, etc.)
 * @param {string} params.desc - Descriptor (nombre o ID del ticket)
 */
async function createNewBranchNonInteractive({ type, desc, push }) {
  if (!type || !desc) {
    throw new Error('En modo no interactivo, debes especificar --type y --desc obligatoriamente.');
  }

  const validTypes = DEFAULT_BRANCH_TYPES.map((t) => t.prefix);
  if (!validTypes.includes(type)) {
    throw new Error(`Tipo de rama inválido "${type}". Tipos permitidos: ${validTypes.join(', ')}`);
  }

  const userAlias = await resolveUserAlias();

  if (userAlias === 'unknown') {
    console.warn(chalk.yellow('Advertencia: No se pudo determinar un alias de usuario (ni por config, ni git). Se usará "unknown".'));
    console.warn(chalk.yellow('Sugerencia: Configura un alias con `gitbrancher config --alias <tu-alias>`.'));
  }

  const branchName = formatBranchName({ userAlias, branchType: type, descriptor: desc });

  await createBranch(branchName);
  console.log(chalk.green(`\n[SUCCESS] Rama creada: ${branchName}`));

  if (push) {
    console.log(chalk.gray('Pushing al remoto...'));
    await pushBranch(branchName);
    console.log(chalk.green(`[SUCCESS] Rama subida a origin/${branchName}`));
  }
}


/**
 * Presenta un flujo interactivo para solicitar la información necesaria
 * y crear una nueva rama con la convención <alias>/<tipo>/<nombre>.
 * @returns {Promise<void>} Una promesa que se resuelve cuando la rama ha sido creada.
 */
async function createNewBranchInteractive({ push } = {}) {
  try {
    console.log(chalk.cyan('\nVamos a crear una nueva rama siguiendo el flujo estandarizado.'));

    const azureConfig = await getEffectiveAzureConfig();
    let selectedWorkItem = null;
    let inferredTypeFromAzure = null;

    if (hasAzureCredentials(azureConfig)) {
      const { useAzure } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'useAzure',
          default: true,
          message: 'Se detectó configuración de Azure DevOps. ¿Quieres seleccionar un backlog asignado?'
            + ' (Usaremos tu PAT y organización configurados).',
        },
      ]);

      if (useAzure) {
        try {
          console.log(chalk.gray('\nConsultando Azure DevOps...'));
          const items = await fetchAssignedWorkItems({
            organization: azureConfig.organization,
            project: azureConfig.project,
            team: azureConfig.team,
            pat: azureConfig.pat,
          });

          if (items.length === 0) {
            console.log(chalk.yellow('No se encontraron elementos asignados. Continuaremos con flujo manual.'));
          } else {
            const { workItemId } = await inquirer.prompt([
              {
                type: 'list',
                name: 'workItemId',
                message: 'Selecciona el work item que quieres usar:',
                choices: items.map((item) => ({
                  name: `#${item.id} · ${item.workItemType} · ${item.title} (${item.state})`,
                  value: item.id,
                })),
              },
            ]);

            selectedWorkItem = items.find((item) => item.id === workItemId) || null;
            inferredTypeFromAzure = selectedWorkItem ? inferBranchTypeFromWorkItem(selectedWorkItem) : null;
          }
        } catch (error) {
          console.error(chalk.red('\nNo fue posible consumir Azure DevOps:'), chalk.red(error.message));
          console.error(chalk.gray('Continuaremos con el flujo manual.'));
        }
      }
    }

    const questions = [
      {
        type: 'list',
        name: 'branchType',
        message: 'Selecciona el tipo de rama que quieres crear:',
        choices: DEFAULT_BRANCH_TYPES.map((type) => ({
          name: `${type.prefix}/ → ${type.description}`,
          value: type.prefix,
        })),
        default: inferredTypeFromAzure || undefined,
      },
      {
        type: 'maxlength-input',
        name: 'descriptor',
        message: `Introduce un nombre descriptivo o ID de ticket (máx. ${MAX_SEGMENT_LENGTH} caracteres):`,
        maxLength: MAX_SEGMENT_LENGTH,
        validate: (value) => {
          if (!value || !value.trim()) {
            return 'El nombre descriptivo no puede estar vacío.';
          }
          return true;
        },
        default: selectedWorkItem
          ? `${selectedWorkItem.id}-${slugifySegment(selectedWorkItem.title)}`.substring(0, MAX_SEGMENT_LENGTH)
          : undefined,
      },
    ];

    const answers = await inquirer.prompt(questions);

    const userAlias = await resolveUserAlias();
    setStoredAlias(userAlias);
    const branchName = formatBranchName({ userAlias, branchType: answers.branchType, descriptor: answers.descriptor });

    console.log(chalk.gray(`
Alias seleccionado: ${chalk.white(userAlias)}
Tipo de rama: ${chalk.white(answers.branchType)}
Descriptor: ${chalk.white(answers.descriptor)}
${selectedWorkItem ? `Work item Azure: ${chalk.white(`#${selectedWorkItem.id} ${selectedWorkItem.title}`)}` : ''}
`));

    await createBranch(branchName);

    console.log(chalk.green(`\n[SUCCESS] Rama creada: ${branchName}`));
    console.log(chalk.gray('Puedes comenzar a trabajar en tu nueva rama inmediatamente.\n'));

    // Flujo de Push opcional o solicitado
    let shouldPush = push;
    if (shouldPush === undefined || shouldPush === false) {
      const answer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'wantToPush',
          message: '¿Quieres subir esta rama al repositorio remoto ahora?',
          default: false,
        },
      ]);
      shouldPush = answer.wantToPush;
    }

    if (shouldPush) {
      console.log(chalk.gray('Subiendo rama a remote...'));
      await pushBranch(branchName);
      console.log(chalk.green(`[SUCCESS] Rama subida a origin/${branchName}`));
    }

  } catch (error) {
    console.error(chalk.red('\n[ERROR] Ocurrió un error al crear la rama:'));
    console.error(chalk.red(error.message));
    console.error(chalk.gray('\nSugerencia: puedes ejecutar el comando con --silent para omitir el banner si deseas agilizar la ejecución.'));
  }
}

module.exports = {
  createNewBranch,
  createNewBranchInteractive, // Kept for backward compatibility or testing if needed
};
