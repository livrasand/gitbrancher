const chalk = require('chalk');
const { logout } = require('../../utils/auth');

async function logoutCommand() {
  console.log(chalk.cyan('Cerrando sesión de GitBrancher\n'));

  const result = await logout();

  if (result.success) {
    console.log(chalk.green(result.message));
  } else {
    console.log(chalk.red(result.message));
  }
}

module.exports = logoutCommand;
