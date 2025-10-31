const inquirerModule = require('inquirer');
const inquirer = inquirerModule.default || inquirerModule;
const chalk = require('chalk');
const { DEFAULT_BRANCH_TYPES } = require('../constants/branchTypes');
const { resolveUserAlias, setStoredAlias } = require('../../config/userConfig');
const { createBranch } = require('../../git/gitService');
const { formatBranchName } = require('../utils/branchName');
const { getEffectiveAzureConfig, hasAzureCredentials } = require('../../config/azureConfig');
const { fetchAssignedWorkItems, inferBranchTypeFromWorkItem } = require('../../integrations/azureDevOpsService');

/**
 * Presenta un flujo interactivo para solicitar la información necesaria
 * y crear una nueva rama con la convención <alias>/<tipo>/<nombre>.
 * @returns {Promise<void>} Una promesa que se resuelve cuando la rama ha sido creada.
 */
async function createNewBranchInteractive() {
  try {
    console.log(chalk.cyan('\nVamos a crear una nueva rama siguiendo el flujo estandarizado.'));

    const azureConfig = getEffectiveAzureConfig();
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
        type: 'input',
        name: 'descriptor',
        message: 'Introduce un nombre descriptivo o ID de ticket (por ejemplo, 383265-misplaced-pictures-hlc-39):',
        validate: (value) => {
          if (!value || !value.trim()) {
            return 'El nombre descriptivo no puede estar vacío.';
          }
          return true;
        },
        default: selectedWorkItem ? `${selectedWorkItem.id}-${selectedWorkItem.title}` : undefined,
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

    console.log(chalk.green(`\n✅ Rama creada: ${branchName}`));
    console.log(chalk.gray('Puedes comenzar a trabajar en tu nueva rama inmediatamente.\n'));
  } catch (error) {
    console.error(chalk.red('\n❌ Ocurrió un error al crear la rama:'));
    console.error(chalk.red(error.message));
    console.error(chalk.gray('\nSugerencia: puedes ejecutar el comando con --silent para omitir el banner si deseas agilizar la ejecución.'));
  }
}

module.exports = {
  createNewBranchInteractive,
};
