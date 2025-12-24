#!/usr/bin/env node

/**
 * Script de migración manual de credenciales de Configstore a Keychain
 * Este script es opcional ya que la migración se hace automáticamente,
 * pero puede ser útil para verificar o forzar la migración.
 */

const chalk = require('chalk');
const { migrateFromConfigstore, getSecureAzureConfig } = require('../src/config/secureCredentials');

async function runMigration() {
    console.log(chalk.cyan('\n🔐 Migración de Credenciales de GitBrancher\n'));
    console.log(chalk.gray('Este script migrará tus credenciales de Azure DevOps desde Configstore'));
    console.log(chalk.gray('al almacenamiento seguro del sistema operativo (Keychain en macOS).\n'));

    try {
        console.log(chalk.gray('Verificando credenciales existentes...'));

        const migrated = await migrateFromConfigstore();

        if (migrated) {
            console.log(chalk.green('\n✅ Migración completada exitosamente!'));
            console.log(chalk.gray('Tus credenciales ahora están almacenadas de forma segura en el keychain del sistema.\n'));

            // Verificar que las credenciales se migraron correctamente
            const config = await getSecureAzureConfig();
            console.log(chalk.cyan('Credenciales migradas:'));
            console.log(`  ${chalk.gray('Organización:')} ${config.organization ? chalk.green('✓') : chalk.yellow('No configurada')}`);
            console.log(`  ${chalk.gray('Proyecto:')} ${config.project ? chalk.green('✓') : chalk.yellow('No configurado')}`);
            console.log(`  ${chalk.gray('Equipo:')} ${config.team ? chalk.green('✓') : chalk.gray('No especificado')}`);
            console.log(`  ${chalk.gray('Usuario:')} ${config.user ? chalk.green('✓') : chalk.gray('No especificado')}`);
            console.log(`  ${chalk.gray('PAT:')} ${config.pat ? chalk.green('✓ (oculto por seguridad)') : chalk.yellow('No configurado')}`);
        } else {
            console.log(chalk.yellow('\nℹ️  No se encontraron credenciales para migrar.'));
            console.log(chalk.gray('Esto puede significar que:'));
            console.log(chalk.gray('  1. Ya se realizó la migración anteriormente'));
            console.log(chalk.gray('  2. No tienes credenciales configuradas en Configstore'));
            console.log(chalk.gray('  3. Tus credenciales ya están en el keychain seguro\n'));

            // Verificar si hay credenciales en el keychain
            const config = await getSecureAzureConfig();
            const hasCredentials = config.organization || config.project || config.pat;

            if (hasCredentials) {
                console.log(chalk.green('✓ Se encontraron credenciales en el almacenamiento seguro:'));
                console.log(`  ${chalk.gray('Organización:')} ${config.organization ? chalk.green('✓') : chalk.yellow('No configurada')}`);
                console.log(`  ${chalk.gray('Proyecto:')} ${config.project ? chalk.green('✓') : chalk.yellow('No configurado')}`);
                console.log(`  ${chalk.gray('PAT:')} ${config.pat ? chalk.green('✓ (oculto por seguridad)') : chalk.yellow('No configurado')}`);
            } else {
                console.log(chalk.gray('No se encontraron credenciales en ningún almacenamiento.'));
                console.log(chalk.gray('Puedes configurarlas con: gitbrancher config --azure\n'));
            }
        }

        console.log(chalk.cyan('\n📚 Información adicional:'));
        console.log(chalk.gray('  - Las credenciales ahora se almacenan en el keychain del sistema'));
        console.log(chalk.gray('  - El PAT está encriptado y protegido por el sistema operativo'));
        console.log(chalk.gray('  - La migración es automática en cada ejecución si es necesario'));
        console.log(chalk.gray('  - Puedes actualizar tus credenciales con: gitbrancher config --azure\n'));

    } catch (error) {
        console.error(chalk.red('\n❌ Error durante la migración:'));
        console.error(chalk.red(error.message));
        console.error(chalk.gray('\nSi el problema persiste, puedes:'));
        console.error(chalk.gray('  1. Reconfigurar tus credenciales: gitbrancher config --azure'));
        console.error(chalk.gray('  2. Reportar el problema en: https://github.com/livrasand/gitbrancher/issues\n'));
        process.exit(1);
    }
}

runMigration();
