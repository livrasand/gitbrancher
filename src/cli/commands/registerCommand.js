const inquirerModule = require('inquirer');
const inquirer = inquirerModule.default || inquirerModule;
const chalk = require('chalk');
const { register } = require('../../utils/auth');

async function registerCommand() {
  console.log(chalk.cyan('Registro en GitBrancher\n'));

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
      mask: '*',
      validate: (input) => input.length >= 6 || 'La contraseña debe tener al menos 6 caracteres'
    }
  ]);

  const result = await register(answers.email, answers.password);

  if (result.success) {
    console.log(chalk.green(result.message));
  } else {
    console.log(chalk.red(result.message));
  }
}

module.exports = registerCommand;
