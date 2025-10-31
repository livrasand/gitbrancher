const chalk = require('chalk');
const { DEFAULT_BRANCH_TYPES } = require('../constants/branchTypes');

/**
 * Imprime en consola los tipos de ramas soportados por el CLI junto con su descripción.
 */
function listBranchTypes() {
  console.log(chalk.bold.cyan('\nTipos de ramas disponibles:'));
  DEFAULT_BRANCH_TYPES.forEach((type) => {
    console.log(`${chalk.green(type.prefix.padEnd(10))} ${chalk.gray('→')} ${type.description}`);
  });
  console.log();
}

module.exports = {
  listBranchTypes,
};
