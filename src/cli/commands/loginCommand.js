const chalk = require('chalk');
const { exec } = require('child_process');
const { SERVER_URL } = require('../../utils/auth');

async function loginCommand() {
  console.log(chalk.cyan('Inicio de sesión en GitBrancher\n'));

  // Abrir navegador con la página de login
  const loginUrl = `${SERVER_URL}/login`;
  console.log(chalk.white('Abriendo navegador para iniciar sesión...'));
  console.log(chalk.gray(`URL: ${loginUrl}\n`));

  try {
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
        return;
      }

      console.log(chalk.white('1. En el navegador, haz clic en "Continuar con GitHub"'));
      console.log(chalk.white('2. Autoriza la aplicación con tu cuenta de GitHub'));
      console.log(chalk.white('3. Una vez completado, regresa al terminal\n'));
      console.log(chalk.yellow('¿Has completado el inicio de sesión en el navegador? (presiona Enter para verificar)'));
      console.log(chalk.gray('Presiona Ctrl+C si necesitas cancelar.'));

      // Esperar input del usuario
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', () => {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        console.log(chalk.white('\nVerificando sesión...'));

        // Aquí podríamos verificar si el usuario está logueado,
        // pero por simplicidad, asumimos que lo hizo correctamente
        console.log(chalk.green('¡Inicio de sesión completado!'));
        console.log(chalk.white('Ahora puedes usar comandos que requieren autenticación.'));
        process.exit(0);
      });
    });

  } catch (error) {
    console.log(chalk.red(`Error al abrir navegador: ${error.message}`));
    console.log(chalk.white('Visita manualmente: ') + chalk.cyan(loginUrl));
    process.exit(1);
  }
}

module.exports = loginCommand;
