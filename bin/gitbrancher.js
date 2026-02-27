#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const inquirerModule = require('inquirer');
const inquirer = inquirerModule.default || inquirerModule;
const pkg = require('../package.json');
const { printBanner } = require('../src/cli/display/banner');
const { createNewBranch } = require('../src/cli/commands/newCommand');
const { listBranchTypes } = require('../src/cli/commands/listTypesCommand');
const { printHelp } = require('../src/cli/commands/helpCommand');
const { printBranchInfo } = require('../src/cli/commands/infoCommand');
const { resolveUserAlias, setStoredAlias, clearStoredAlias, getStoredAlias } = require('../src/config/userConfig');
const { getEffectiveAzureConfig, setAzureConfig, clearAzureConfig, hasAzureCredentials } = require('../src/config/azureConfig');
const { listPullRequests } = require('../src/cli/commands/prListCommand');
const { analyzePullRequest } = require('../src/cli/commands/prAnalyzeCommand');
const { analyzeBranchPatterns } = require('../src/cli/commands/analyzePatternsCommand');

const registerCommand = require('../src/cli/commands/registerCommand');
const loginCommand = require('../src/cli/commands/loginCommand');
const logoutCommand = require('../src/cli/commands/logoutCommand');
const creditsCommand = require('../src/cli/commands/creditsCommand');

const program = new Command();

program
  .name('gitbrancher')
  .description('CLI para crear ramas Git con nombres estandarizados según el tipo de trabajo.')
  .version(pkg.version);

program
  .command('new')
  .description('Crea una nueva rama siguiendo la convención <usuario>/<tipo>/<descriptor>.')
  .option('-s, --silent', 'Omite el banner de bienvenida.')
  .option('-t, --type <type>', 'Tipo de rama (feature, bugfix, etc.)')
  .option('-d, --desc <descriptor>', 'Descripción de la rama o ID del ticket.')
  .option('--push', 'Sube la rama recién creada al repositorio remoto (origin).')
  .option('--no-interactive', 'Ejecuta en modo no interactivo (requiere --type y --desc).')
  .action(async (options) => {
    try {
      if (!options.silent) {
        printBanner();
      }
      await createNewBranch(options);
    } catch (error) {
      console.error(chalk.red(`\nError: ${error.message}`));
      process.exitCode = 1;
    }
  });

program
  .command('analyze-patterns')
  .description('Analiza el historial de ramas para detectar patrones de uso en el equipo.')
  .action(async () => {
    try {
      printBanner();
      await analyzeBranchPatterns();
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
  .command('info')
  .alias('status')
  .description('Muestra información de la rama actual y valida si cumple la convención.')
  .action(async () => {
    printBanner();
    await printBranchInfo();
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
      await clearAzureConfig();
      console.log(chalk.green('Configuración de Azure DevOps eliminada correctamente.'));
      performedAction = true;
    }

    if (options.azure) {
      const currentAzure = await getEffectiveAzureConfig();

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
        await setAzureConfig(updates);
        console.log(chalk.green('Configuración de Azure DevOps actualizada.'));
      } else {
        console.log(chalk.yellow('No se detectaron cambios en la configuración de Azure DevOps.'));
      }

      const updatedAzure = await getEffectiveAzureConfig();
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
    const azureConfig = await getEffectiveAzureConfig();

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

program
  .command('register')
  .description('Regístrate en GitBrancher')
  .action(async () => {
    await registerCommand();
  });

program
  .command('login')
  .description('Inicia sesión en GitBrancher')
  .action(async () => {
    await loginCommand();
  });

program
  .command('logout')
  .description('Cierra sesión en GitBrancher')
  .action(async () => {
    await logoutCommand();
  });

program
  .command('credits')
  .description('Mostrar créditos AI disponibles')
  .action(async () => {
    await creditsCommand();
  });

const prCommand = program
  .command('pr')
  .description('Comandos relacionados con Pull Requests');

prCommand
  .command('list')
  .description('Lista los Pull Requests del repositorio')
  .option('-s, --status <status>', 'Estado de PRs (active, completed, all)', 'active')
  .option('-n, --number <number>', 'Número de PRs a mostrar', '20')
  .action(async (options) => {
    printBanner();
    await listPullRequests(options);
  });

prCommand
  .command('analyze <prId>')
  .description('Analiza un PR específico y genera el grafo de impacto')
  .option('-o, --output <file>', 'Archivo de salida para el grafo JSON', 'graph.json')
  .option('--html', 'Generar visualización HTML interactiva')
  .option('-m, --mermaid', 'Generar diagrama en formato Mermaid (.mmd)')
  .option('--open', 'Abrir automáticamente la visualización en el navegador (requiere --html)')
  .option('--ai', 'Analizar con AI')
  .option('--ai-full', 'Análisis completo con AI de cada archivo modificado (requiere --ai)')
  .action(async (prId, options) => {
    printBanner();
    await analyzePullRequest({ prId, ...options });
  });

if (!process.argv.slice(2).length) {
  printBanner();
  program.outputHelp();
} else {
  program.parseAsync(process.argv);
}
