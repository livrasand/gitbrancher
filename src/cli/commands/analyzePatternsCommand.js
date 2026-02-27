const chalk = require('chalk');
const { getAllBranches } = require('../../git/gitService');
const { DEFAULT_BRANCH_TYPES } = require('../constants/branchTypes');

/**
 * Analiza el historial de ramas para detectar patrones de uso reales en el equipo.
 * Calcula porcentajes por tipo de rama y muestra un resumen.
 */
async function analyzeBranchPatterns() {
  try {
    const branches = await getAllBranches();

    // Filtrar ramas para ignorar HEAD y ramas duplicadas (locales que ya están en remotas)
    // También ignoramos las que parecen ser temporales o no siguen el formato esperado
    // Pero el requerimiento dice "Analiza ramas locales y/o remotas", "Ignora ramas eliminadas"
    // simple-git branch -a ya nos da las ramas existentes.

    const branchCounts = {};
    let totalStandardBranches = 0;

    // Limpiar nombres de ramas (quitar 'remotes/origin/')
    const cleanedBranches = [...new Set(branches.map(b => b.replace('remotes/origin/', '').replace('origin/', '')))];

    cleanedBranches.forEach(branch => {
      // Ignorar HEAD
      if (branch.includes('HEAD ->')) return;
      if (branch === 'master' || branch === 'main' || branch === 'develop') return;

      // Intentar identificar el tipo de rama basándose en los prefijos estándar
      // Formatos comunes: <alias>/<tipo>/... o <tipo>/...
      let detectedType = null;

      for (const type of DEFAULT_BRANCH_TYPES) {
        const prefix = type.prefix + '/';
        // Caso <tipo>/...
        if (branch.startsWith(prefix)) {
          detectedType = type.prefix;
          break;
        }
        // Caso <alias>/<tipo>/...
        const parts = branch.split('/');
        if (parts.length >= 2 && parts[1] === type.prefix) {
          detectedType = type.prefix;
          break;
        }
      }

      if (detectedType) {
        branchCounts[detectedType] = (branchCounts[detectedType] || 0) + 1;
        totalStandardBranches++;
      }
    });

    console.log(chalk.cyan('\nAnalizando patrones de nomenclatura de ramas...'));

    if (totalStandardBranches === 0) {
      console.log(chalk.yellow('\nNo se detectaron ramas que sigan los patrones estándar.'));
      console.log(chalk.gray('Asegúrate de usar "gitbrancher new" para crear tus ramas.'));
      return;
    }

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
    console.error(chalk.red(`\nError al analizar patrones de ramas: ${error.message}`));
  }
}

module.exports = {
  analyzeBranchPatterns,
};
