const chalk = require('chalk');

async function registerCommand() {
  console.log(chalk.cyan('Registro en GitBrancher\n'));
  console.log(chalk.yellow('⚠️  El registro tradicional ya no está disponible.'));
  console.log(chalk.white('Ahora GitBrancher usa únicamente autenticación con GitHub.\n'));
  console.log(chalk.white('Para registrarte:'));
  console.log(chalk.gray('1. Ve a https://gbserver-livrasand3864-uaxx2qjp.leapcell.dev'));
  console.log(chalk.gray('2. Haz clic en "Comenzar con GitHub"'));
  console.log(chalk.gray('3. Autoriza la aplicación con tu cuenta de GitHub'));
  console.log(chalk.gray('4. ¡Listo! Tu cuenta se crea automáticamente\n'));
  console.log(chalk.white('Para iniciar sesión desde CLI:'));
  console.log(chalk.gray('  gitbrancher login'));
  console.log(chalk.white('\n¿Quieres abrir la página web ahora? (y/n): '), { stdio: 'inherit' });
}

module.exports = registerCommand;
