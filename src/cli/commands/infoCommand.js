const chalk = require('chalk');
const { getCurrentBranch } = require('../../git/gitService');
const { DEFAULT_BRANCH_TYPES } = require('../constants/branchTypes');

/**
 * Muestra información sobre la rama actual y verifica si cumple con la convención.
 */
async function printBranchInfo() {
    try {
        const currentBranch = await getCurrentBranch();
        console.log(`\n${chalk.gray('Rama actual:')} ${chalk.bold.white(currentBranch)}`);

        // Convención: <alias>/<tipo>/<descriptor>
        const regex = /^([^/]+)\/([^/]+)\/(.+)$/;
        const match = currentBranch.match(regex);

        if (match) {
            const [, alias, type, descriptor] = match;
            const isValidType = DEFAULT_BRANCH_TYPES.some((t) => t.prefix === type);

            console.log(`${chalk.gray('Estado:')} ${chalk.green('[SUCCESS] Cumple la convención de GitBrancher')}`);
            console.log(`${chalk.gray('  ├─ Alias:')} ${chalk.cyan(alias)}`);

            if (isValidType) {
                console.log(`${chalk.gray('  ├─ Tipo:')} ${chalk.green(type)}`);
            } else {
                console.log(`${chalk.gray('  ├─ Tipo:')} ${chalk.yellow(type)} (No estándar)`);
            }

            // Check for Work Item ID in descriptor (starts with numbers)
            const workItemMatch = descriptor.match(/^(\d+)/);
            if (workItemMatch) {
                console.log(`${chalk.gray('  └─ Work Item:')} ${chalk.magenta('#' + workItemMatch[1])}`);
                console.log(`${chalk.gray('     Descriptor:')} ${chalk.white(descriptor)}`);
            } else {
                console.log(`${chalk.gray('  └─ Descriptor:')} ${chalk.white(descriptor)}`);
            }

        } else {
            console.log(`${chalk.gray('Estado:')} ${chalk.yellow('[WARNING] No sigue la estructura <alias>/<tipo>/<descriptor>')}`);
            console.log(chalk.gray('Sugerencia: Usa `gitbrancher new` para crear ramas estandarizadas.'));
        }

        console.log(''); // Empty line for spacing

    } catch (error) {
        console.error(chalk.red(`\nError obteniendo info de la rama: ${error.message}`));
    }
}

module.exports = {
    printBranchInfo,
};
