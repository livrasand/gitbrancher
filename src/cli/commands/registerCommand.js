const chalk = require('chalk');
const inquirerModule = require('inquirer');
const inquirer = inquirerModule.default || inquirerModule;
const { exec } = require('child_process');

async function registerCommand() {
  console.log(chalk.cyan('Registro en GitBrancher\n'));
  console.log(chalk.yellow('⚠️  El registro tradicional ya no está disponible.'));
  console.log(chalk.white('Ahora GitBrancher usa únicamente autenticación con GitHub.\n'));
  console.log(chalk.white('Para registrarte:'));
  console.log(chalk.gray('1. Ve a https://gbserver-livrasand3864-uaxx2qjp.leapcell.dev'));
  console.log(chalk.gray('2. Haz clic en "Comenzar con GitHub"'));
  console.log(chalk.gray('3. Autoriza la aplicación con tu cuenta de GitHub'));
  console.log(chalk.gray('4. ¡Listo! Tu cuenta se crea automáticamente\n'));

  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'openBrowser',
      message: '¿Quieres abrir la página web ahora?',
      default: true
    }
  ]);

  if (answers.openBrowser) {
    const loginUrl = 'https://gbserver-livrasand3864-uaxx2qjp.leapcell.dev';
    console.log(chalk.white('\nAbriendo navegador...'));
    console.log(chalk.gray(`URL: ${loginUrl}`));

    // Abrir navegador usando comando del sistema
    const platform = process.platform;
    let openCommand;

    if (platform === 'darwin') { // macOS
      openCommand = `open "${loginUrl}"`;
    } else if (platform === 'win32') { // Windows
      openCommand = `start "" "${loginUrl}"`;
    } else { // Linux/Unix
      openCommand = `xdg-open "${loginUrl}"`;
    }

    exec(openCommand, (error) => {
      if (error) {
        console.log(chalk.red(`Error al abrir navegador: ${error.message}`));
        console.log(chalk.white('Visita manualmente: ') + chalk.cyan(loginUrl));
      } else {
        console.log(chalk.green('¡Navegador abierto! Completa el registro en GitHub.'));
      }
    });
  } else {
    console.log(chalk.white('Para registrarte, visita: ') + chalk.cyan('https://gbserver-livrasand3864-uaxx2qjp.leapcell.dev'));
    console.log(chalk.white('O usa: ') + chalk.cyan('gitbrancher login'));
  }
}

module.exports = registerCommand;
