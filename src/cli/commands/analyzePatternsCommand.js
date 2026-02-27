const chalk = require('chalk');
const { getAllBranches } = require('../../git/gitService');
const { DEFAULT_BRANCH_TYPES } = require('../constants/branchTypes');
const { createSpinner } = require('../display/spinner');

/**
 * Analiza el historial de ramas para detectar patrones de uso reales en el equipo.
 * Calcula porcentajes por tipo de rama y muestra un resumen.
 */
async function analyzeBranchPatterns() {
  const spinner = createSpinner('Analizando patrones de nomenclatura de ramas...');
  try {
    // Obtenemos ramas realizando un prune para ignorar las ya eliminadas en el remoto
    const branches = await getAllBranches({ prune: true });

    const branchCounts = {};
    let totalStandardBranches = 0;

    // Limpiar nombres de ramas (quitar 'remotes/origin/') y deduplicar
    const cleanedBranches = [...new Set(branches.map(b => b.replace('remotes/origin/', '').replace('origin/', '')))];

    cleanedBranches.forEach(branch => {
      // Ignorar HEAD y ramas principales
      if (branch.includes('HEAD ->')) return;
      if (branch === 'master' || branch === 'main' || branch === 'develop') return;

      // Intentar identificar el tipo de rama basándose en los prefijos estándar
      let detectedType = null;

      for (const type of DEFAULT_BRANCH_TYPES) {
        const parts = branch.split('/');
        // Detectar si el tipo está en cualquier parte de la ruta (más robusto)
        // Pero priorizamos la estructura estándar: <tipo>/... o <alias>/<tipo>/...
        if (branch.startsWith(type.prefix + '/') || (parts.length >= 2 && parts[1] === type.prefix)) {
          detectedType = type.prefix;
          break;
        }
      }

      if (detectedType) {
        branchCounts[detectedType] = (branchCounts[detectedType] || 0) + 1;
        totalStandardBranches++;
      }
    });

    if (totalStandardBranches === 0) {
      spinner.info('No se detectaron suficientes ramas estándar para el análisis.');
      console.log(chalk.gray('Asegúrate de usar "gitbrancher new" para crear tus ramas.'));
      return;
    }

    spinner.succeed('Análisis de ramas completado.');

    // Ordenar por frecuencia
    const sortedPatterns = Object.entries(branchCounts)
      .sort((a, b) => b[1] - a[1]);

    console.log(chalk.white('\nTu equipo usa principalmente:'));

    sortedPatterns.forEach(([type, count]) => {
      const percentage = ((count / totalStandardBranches) * 100).toFixed(0);
      console.log(`${chalk.gray('-')} ${chalk.green(type + '/')} ${chalk.white(`(${percentage}%)`)}`);
    });

    console.log(''); // Espacio final

  } catch (error) {
    spinner.fail(`Error al analizar patrones de ramas: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  analyzeBranchPatterns,
};
