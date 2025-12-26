const inquirerModule = require('inquirer');
const inquirer = inquirerModule.default || inquirerModule;
const chalk = require('chalk');
const { login } = require('../../utils/auth');

async function loginCommand() {
  console.log(chalk.cyan('Inicio de sesión en GitBrancher\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'email',
      message: 'Email:',
      validate: (input) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(input) || 'Ingresa un email válido';
      }
    },
    {
      type: 'password',
      name: 'password',
      message: 'Contraseña:',
      mask: '*'
    }
  ]);

  const result = await login(answers.email, answers.password);

  if (result.success) {
    console.log(chalk.green(result.message));
  } else {
    console.log(chalk.red(result.message));
  }
}

module.exports = loginCommand;
