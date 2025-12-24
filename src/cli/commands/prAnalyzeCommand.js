const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { fetchPullRequestDetails } = require('../../integrations/azureDevOpsService');
const { getEffectiveAzureConfig } = require('../../config/azureConfig');
const { analyzeDependencies } = require('../../utils/dependencyAnalyzer');
const pkg = require('../../../package.json');

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
 * Genera el contrato JSON del grafo de impacto del PR
 * @param {Object} prDetails - Detalles del PR con archivos modificados
 * @param {string} repoRoot - Ruta raíz del repositorio
 * @returns {Object} Contrato JSON del grafo
 */
function generateImpactGraph(prDetails, repoRoot) {
  // Nodos de archivos modificados
  const modifiedNodes = prDetails.changedFiles.map(file => ({
    id: file.path,
    label: path.basename(file.path),
    kind: 'file',
    status: file.changeType.toLowerCase(),
    modified: true,
    url: file.url
  }));

  // Analizar dependencias entre archivos para generar edges
  const { edges, affectedFiles } = analyzeDependencies(prDetails.changedFiles, repoRoot, {
    includeReverseDeps: true,
    maxDepth: 2
  });

  // Nodos de archivos afectados (no modificados directamente)
  const affectedNodes = affectedFiles.map(filePath => ({
    id: filePath,
    label: path.basename(filePath),
    kind: 'file',
    status: 'affected',
    modified: false
  }));

  const allNodes = [...modifiedNodes, ...affectedNodes];

  return {
    meta: {
      tool: 'gitbrancher',
      version: pkg.version,
      type: 'pr-impact',
      base: prDetails.targetRefName,
      head: prDetails.sourceRefName,
      prId: prDetails.id,
      prTitle: prDetails.title,
      generatedAt: new Date().toISOString(),
      stats: {
        modifiedFiles: modifiedNodes.length,
        affectedFiles: affectedNodes.length,
        totalFiles: allNodes.length,
        dependencies: edges.length
      }
    },
    nodes: allNodes,
    edges: edges
  };
}

/**
 * Analiza un Pull Request específico y genera el grafo de impacto
 * @param {Object} options - Opciones del comando
 * @param {string} options.prId - ID del Pull Request a analizar
 * @param {string} options.output - Archivo de salida (por defecto: graph.json)
 */
async function analyzePullRequest(options) {
  try {
    const azureConfig = await getEffectiveAzureConfig();

    if (!azureConfig.pat) {
      console.error(chalk.red('\nError: Token personal (PAT) de Azure DevOps no configurado.'));
      console.log(chalk.yellow('Ejecuta "gitbrancher config --azure" para configurarlo.\n'));
      process.exit(1);
    }

    const repoInfo = getRepositoryInfo();

    console.log(chalk.cyan(`\nAnalizando PR #${options.prId} en ${repoInfo.organization}/${repoInfo.project}/${repoInfo.repository}...`));

    const prDetails = await fetchPullRequestDetails({
      organization: repoInfo.organization,
      project: repoInfo.project,
      repository: repoInfo.repository,
      pat: azureConfig.pat,
      pullRequestId: options.prId
    });

    console.log(chalk.blue(`PR: ${prDetails.title}`));
    console.log(chalk.gray(`Estado: ${prDetails.status} | Creado por: ${prDetails.createdBy}`));
    console.log(chalk.gray(`Rama: ${prDetails.sourceRefName} → ${prDetails.targetRefName}`));

    // Obtener la ruta raíz del repositorio
    const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();

    // Generar grafo de impacto
    const impactGraph = generateImpactGraph(prDetails, repoRoot);

    console.log(chalk.cyan(`\nAnalizando dependencias...`));

    // Guardar el archivo JSON
    const outputFile = options.output || 'graph.json';
    fs.writeFileSync(outputFile, JSON.stringify(impactGraph, null, 2));

    console.log(chalk.green(`\n✓ Grafo de impacto generado en: ${outputFile}`));
    console.log(chalk.gray(`Archivos modificados: ${impactGraph.meta.stats.modifiedFiles} | Archivos afectados: ${impactGraph.meta.stats.affectedFiles} | Dependencias: ${impactGraph.meta.stats.dependencies}`));

    // Mostrar resumen de archivos modificados
    const modifiedNodes = impactGraph.nodes.filter(n => n.modified);
    if (modifiedNodes.length > 0) {
      console.log(chalk.cyan('\n📝 Archivos modificados en el PR:'));
      modifiedNodes.forEach((node) => {
        const changeTypeIcon = node.status === 'add' ? chalk.green('➕') :
                              node.status === 'edit' ? chalk.blue('✏️') :
                              node.status === 'delete' ? chalk.red('🗑️') : chalk.gray('❓');
        console.log(`  ${changeTypeIcon} ${node.id}`);
      });
    }

    // Mostrar archivos afectados
    const affectedNodes = impactGraph.nodes.filter(n => !n.modified);
    if (affectedNodes.length > 0) {
      console.log(chalk.yellow(`\n⚠️  Archivos afectados (importan los modificados):`));
      affectedNodes.slice(0, 10).forEach((node) => {
        console.log(`  ${chalk.yellow('⚡')} ${node.id}`);
      });
      if (affectedNodes.length > 10) {
        console.log(chalk.gray(`  ... y ${affectedNodes.length - 10} archivos más`));
      }
    }

  } catch (error) {
    console.error(chalk.red('\nError:'), error.message);

    if (error.message.includes('no parece ser un repositorio de Azure DevOps')) {
      console.log(chalk.yellow('\nEste comando solo funciona con repositorios de Azure DevOps.'));
      console.log(chalk.gray('El repositorio actual parece ser de otro proveedor (GitHub, GitLab, etc.).\n'));
    }

    process.exit(1);
  }
}

module.exports = { analyzePullRequest };
