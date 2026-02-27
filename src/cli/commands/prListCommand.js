const { execSync } = require('child_process');
const chalk = require('chalk');
const { fetchPullRequests } = require('../../integrations/azureDevOpsService');
const { getEffectiveAzureConfig } = require('../../config/azureConfig');
const { createSpinner } = require('../display/spinner');

/**
 * Obtiene el nombre del repositorio desde el remote origin de Git
 * @returns {Object} { organization, project, repository }
 * @throws {Error} Si no se puede determinar el repositorio
 */
function getRepositoryInfo() {
  try {
    const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();

    // Manejar URLs SSH y HTTPS
    let match;
    if (remoteUrl.includes('@ssh.dev.azure.com:')) {
      // SSH: git@ssh.dev.azure.com:v3/{organization}/{project}/{repository}
      match = remoteUrl.match(/git@ssh\.dev\.azure\.com:v3\/([^\/]+)\/([^\/]+)\/(.+)$/);
      if (match && match[3].endsWith('.git')) {
        match[3] = match[3].slice(0, -4);
      }
    } else if (remoteUrl.includes('dev.azure.com')) {
      // HTTPS: https://dev.azure.com/{organization}/{project}/_git/{repository}
      match = remoteUrl.match(/https:\/\/dev\.azure\.com\/([^\/]+)\/([^\/]+)\/_git\/(.+)$/);
      if (match && match[3].endsWith('.git')) {
        match[3] = match[3].slice(0, -4);
      }
    }

    if (!match) {
      throw new Error('El remote origin no parece ser un repositorio de Azure DevOps válido.');
    }

    return {
      organization: match[1],
      project: match[2],
      repository: match[3]
    };
  } catch (error) {
    throw new Error(`No se pudo determinar el repositorio desde Git: ${error.message}`);
  }
}

/**
 * Lista los Pull Requests del repositorio actual
 * @param {Object} options - Opciones del comando
 * @param {string} options.status - Estado de los PRs
 * @param {string} options.number - Número de PRs a mostrar
 */
async function listPullRequests(options) {
  try {
    const azureConfig = await getEffectiveAzureConfig();

    if (!azureConfig.pat) {
      console.error(chalk.red('\nError: Token personal (PAT) de Azure DevOps no configurado.'));
      console.log(chalk.yellow('Ejecuta "gitbrancher config --azure" para configurarlo.\n'));
      process.exit(1);
    }

    const repoInfo = getRepositoryInfo();

    const spinner = createSpinner(`Obteniendo Pull Requests de ${repoInfo.repository}...`);

    const prs = await fetchPullRequests({
      organization: repoInfo.organization,
      project: repoInfo.project,
      repository: repoInfo.repository,
      pat: azureConfig.pat,
      status: options.status,
      top: parseInt(options.number, 10)
    });

    if (prs.length === 0) {
      spinner.info('No se encontraron Pull Requests con los criterios especificados.');
      return;
    }

    spinner.succeed(`Encontrados ${prs.length} Pull Request(s):\n`);

    prs.forEach((pr, index) => {
      const statusColor = pr.status === 'active' ? chalk.green : pr.status === 'completed' ? chalk.blue : chalk.gray;
      console.log(`${chalk.bold(index + 1)}. ${chalk.bold(pr.title)}`);
      console.log(`   ${chalk.gray('ID:')} ${pr.id} | ${chalk.gray('Estado:')} ${statusColor(pr.status)} | ${chalk.gray('Creado por:')} ${pr.createdBy}`);
      console.log(`   ${chalk.gray('Rama:')} ${pr.sourceRefName} → ${pr.targetRefName}`);
      console.log(`   ${chalk.gray('URL:')} ${chalk.blue.underline(pr.url)}`);
      if (pr.description) {
        console.log(`   ${chalk.gray('Descripción:')} ${pr.description.substring(0, 100)}${pr.description.length > 100 ? '...' : ''}`);
      }
      console.log('');
    });
  } catch (error) {
    console.error(chalk.red('\nError:'), error.message);
    
    if (error.message.includes('no parece ser un repositorio de Azure DevOps')) {
      console.log(chalk.yellow('\nEste comando solo funciona con repositorios de Azure DevOps.'));
      console.log(chalk.gray('El repositorio actual parece ser de otro proveedor (GitHub, GitLab, etc.).\n'));
    }
    
    process.exit(1);
  }
}

module.exports = { listPullRequests };
