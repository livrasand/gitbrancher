#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const inquirerModule = require('inquirer');
const inquirer = inquirerModule.default || inquirerModule;
const pkg = require('../package.json');
const { printBanner } = require('../src/cli/display/banner');
const { createNewBranchInteractive } = require('../src/cli/commands/newCommand');
const { listBranchTypes } = require('../src/cli/commands/listTypesCommand');
const { printHelp } = require('../src/cli/commands/helpCommand');
const { resolveUserAlias, setStoredAlias, clearStoredAlias, getStoredAlias } = require('../src/config/userConfig');
const { getEffectiveAzureConfig, setAzureConfig, clearAzureConfig, hasAzureCredentials } = require('../src/config/azureConfig');

const program = new Command();

program
  .name('gitbrancher')
  .description('CLI para crear ramas Git con nombres estandarizados según el tipo de trabajo.')
  .version(pkg.version);

program
  .command('new')
  .description('Crea una nueva rama siguiendo la convención <usuario>/<tipo>/<descriptor>.')
  .option('-s, --silent', 'Omite el banner de bienvenida.')
  .action(async (options) => {
    try {
      if (!options.silent) {
        printBanner();
      }
      await createNewBranchInteractive();
    } catch (error) {
      console.error(chalk.red(`\nError: ${error.message}`));
      process.exitCode = 1;
    }
  });

program
  .command('list-types')
  .description('Muestra los tipos de ramas disponibles y su descripción.')
  .action(() => {
    printBanner();
    listBranchTypes();
  });

program
  .command('config')
  .description('Configura parámetros persistentes como el alias de usuario.')
  .option('-a, --alias <alias>', 'Define un alias fijo para tus ramas.')
  .option('--clear-alias', 'Borra el alias almacenado previamente.')
  .option('--azure', 'Configura las credenciales de Azure DevOps mediante un asistente interactivo.')
  .option('--clear-azure', 'Elimina la configuración almacenada de Azure DevOps.')
  .action(async (options) => {
    let performedAction = false;

    if (options.clearAlias) {
      clearStoredAlias();
      console.log(chalk.green('Alias almacenado eliminado correctamente.'));
      performedAction = true;
    }

    if (options.alias) {
      const trimmedAlias = options.alias.trim();
      if (trimmedAlias.length === 0) {
        console.log(chalk.yellow('El alias proporcionado está vacío. No se realizaron cambios.'));
      } else {
        setStoredAlias(trimmedAlias);
        console.log(chalk.green(`Alias actualizado a: ${trimmedAlias}`));
        performedAction = true;
      }
    }

    if (options.clearAzure) {
      clearAzureConfig();
      console.log(chalk.green('Configuración de Azure DevOps eliminada correctamente.'));
      performedAction = true;
    }

    if (options.azure) {
      const currentAzure = getEffectiveAzureConfig();

      const azureAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'organization',
          message: 'Organización (https://dev.azure.com/<organizacion>):',
          default: currentAzure.organization || '',
          filter: (input) => input.trim(),
        },
        {
          type: 'input',
          name: 'project',
          message: 'Proyecto (nombre exacto en Azure DevOps):',
          default: currentAzure.project || '',
          filter: (input) => input.trim(),
        },
        {
          type: 'input',
          name: 'team',
          message: 'Equipo (opcional, deja vacío para mantener o no usar):',
          default: currentAzure.team || '',
          filter: (input) => input.trim(),
        },
        {
          type: 'input',
          name: 'user',
          message: 'Nombre o correo del usuario (opcional):',
          default: currentAzure.user || '',
          filter: (input) => input.trim(),
        },
        {
          type: 'password',
          name: 'pat',
          message: 'Token personal (PAT) (deja vacío para conservar el actual):',
          mask: '*',
          filter: (input) => input.trim(),
        },
      ]);

      const updates = {};

      if (azureAnswers.organization) {
        updates.organization = azureAnswers.organization;
      }
      if (azureAnswers.project) {
        updates.project = azureAnswers.project;
      }
      if (azureAnswers.team) {
        updates.team = azureAnswers.team;
      }
      if (azureAnswers.user) {
        updates.user = azureAnswers.user;
      }
      if (azureAnswers.pat) {
        updates.pat = azureAnswers.pat;
      }

      if (Object.keys(updates).length > 0) {
        setAzureConfig(updates);
        console.log(chalk.green('Configuración de Azure DevOps actualizada.'));
      } else {
        console.log(chalk.yellow('No se detectaron cambios en la configuración de Azure DevOps.'));
      }

      const updatedAzure = getEffectiveAzureConfig();
      const missingFields = ['organization', 'project', 'pat'].filter((field) => !updatedAzure[field]);

      if (missingFields.length) {
        console.log(chalk.yellow(`Advertencia: faltan campos obligatorios para Azure DevOps (${missingFields.join(', ')}).`));
      } else {
        console.log(chalk.green('Azure DevOps listo para usarse desde "gitbrancher new".'));
      }

      performedAction = true;
    }

    const currentAlias = await resolveUserAlias();
    const storedAlias = getStoredAlias();
    const azureConfig = getEffectiveAzureConfig();

    console.log(chalk.cyan('\nResumen de configuración:'));
    console.log(`${chalk.gray('  Alias efectivo:')} ${chalk.white(currentAlias)}`);
    console.log(`${chalk.gray('  Alias almacenado:')} ${storedAlias ? chalk.white(storedAlias) : chalk.yellow('No definido')}`);

    const azureStatusLines = [
      `${chalk.gray('  Azure organización:')} ${azureConfig.organization ? chalk.white(azureConfig.organization) : chalk.yellow('No definida')}`,
      `${chalk.gray('  Azure proyecto:')} ${azureConfig.project ? chalk.white(azureConfig.project) : chalk.yellow('No definido')}`,
      `${chalk.gray('  Azure equipo:')} ${azureConfig.team ? chalk.white(azureConfig.team) : chalk.white('Sin especificar')}`,
      `${chalk.gray('  Azure usuario:')} ${azureConfig.user ? chalk.white(azureConfig.user) : chalk.white('Sin especificar')}`,
      `${chalk.gray('  Azure PAT:')} ${azureConfig.pat ? chalk.white('Configurado (no se muestra por seguridad)') : chalk.yellow('No configurado')}`,
    ];

    azureStatusLines.forEach((line) => console.log(line));

    if (!performedAction) {
      console.log(chalk.gray('\nSugerencia: utiliza --alias para establecer un alias o --azure para configurar Azure DevOps.'));
    }
  });

program
  .command('help')
  .description('Muestra la ayuda extendida de GitBrancher.')
  .action(() => {
    printBanner();
    printHelp(program);
  });

if (!process.argv.slice(2).length) {
  printBanner();
  program.outputHelp();
} else {
  program.parseAsync(process.argv);
}
