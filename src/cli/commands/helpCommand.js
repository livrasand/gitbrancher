const chalk = require('chalk');
const boxenModule = require('boxen');
const boxen = boxenModule.default || boxenModule;

/**
 * Imprime un panel de ayuda con los comandos principales y ejemplos de uso del CLI.
 * @param {import('commander').Command} program - Instancia principal de Commander para acceder a la versión y nombre.
 */
function printHelp(program) {
  const header = chalk.cyan.bold(`${program.name()} v${program.version()}`);

  const helpContent = [
    `${chalk.bold('Descripción:')} CLI para crear ramas Git con nombres estandarizados.`,
    '',
    `${chalk.bold('Comandos disponibles:')}`,
    `  ${chalk.green('gitbrancher new')} ${chalk.gray('→ Crea una nueva rama con flujo interactivo')}`,
    `  ${chalk.green('gitbrancher list-types')} ${chalk.gray('→ Muestra los tipos de ramas soportados')}`,
    `  ${chalk.green('gitbrancher pr list')} ${chalk.gray('→ Lista los Pull Requests del repositorio')}`,
    `  ${chalk.green('gitbrancher pr analyze <id>')} ${chalk.gray('→ Analiza un PR y genera grafo de impacto')}`,
    `  ${chalk.green('gitbrancher help')} ${chalk.gray('→ Despliega este panel de ayuda')}`,
    '',
    `${chalk.bold('Ejemplo:')}`,
    `  ${chalk.magenta('gitbrancher new')} ${chalk.gray('→ selecciona un tipo y escribe un descriptor')}`,
    `  ${chalk.gray('Resultado:')} ${chalk.yellow('usuario/feature/nueva-funcionalidad')}`,
  ].join('\n');

  const boxed = boxen(helpContent, {
    title: header,
    padding: 1,
    margin: 1,
    borderColor: 'cyan',
  });

  console.log(boxed);
}

module.exports = {
  printHelp,
};
