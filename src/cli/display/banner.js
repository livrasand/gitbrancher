const figlet = require('figlet');
const chalk = require('chalk');
const boxenModule = require('boxen');
const boxen = boxenModule.default || boxenModule;

/**
 * Muestra el logotipo principal de GitBrancher dentro de un contenedor decorativo.
 */
function printBanner() {
  const asciiArt = figlet.textSync('GitBrancher', {
    font: 'Standard',
    horizontalLayout: 'default',
    verticalLayout: 'default',
  });

  const boxed = boxen(chalk.cyan(asciiArt), {
    padding: {
      top: 0,
      bottom: 0,
      left: 2,
      right: 2,
    },
    borderColor: 'cyan',
    margin: 1,
  });

  console.log(boxed);
}

module.exports = {
  printBanner,
};
