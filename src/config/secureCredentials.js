const keytar = require('keytar');
const ConfigstoreModule = require('configstore');
const Configstore = ConfigstoreModule.default || ConfigstoreModule;

const SERVICE_NAME = 'gitbrancher';
const CONFIG_NAMESPACE = 'gitbrancher';
const AZURE_CONFIG_KEY = 'azure';

// Instancia de Configstore para migración
const configStore = new Configstore(CONFIG_NAMESPACE);

/**
 * Nombres de las credenciales en el keychain
 */
const CREDENTIAL_KEYS = {
    AZURE_PAT: 'azure-pat',
    AZURE_ORGANIZATION: 'azure-organization',
    AZURE_PROJECT: 'azure-project',
    AZURE_TEAM: 'azure-team',
    AZURE_USER: 'azure-user',
};

/**
 * Guarda una credencial de forma segura en el keychain del sistema operativo.
 * @param {string} key - Clave de la credencial (usar CREDENTIAL_KEYS)
 * @param {string} value - Valor de la credencial
 * @returns {Promise<void>}
 */
async function setSecureCredential(key, value) {
    if (!value || typeof value !== 'string' || !value.trim()) {
        return;
    }

    try {
        await keytar.setPassword(SERVICE_NAME, key, value.trim());
    } catch (error) {
        console.error(`Error al guardar credencial segura (${key}):`, error.message);
        throw new Error(`No se pudo guardar la credencial de forma segura: ${error.message}`);
    }
}

/**
 * Obtiene una credencial del keychain del sistema operativo.
 * @param {string} key - Clave de la credencial (usar CREDENTIAL_KEYS)
 * @returns {Promise<string | null>} Valor de la credencial o null si no existe
 */
async function getSecureCredential(key) {
    try {
        const value = await keytar.getPassword(SERVICE_NAME, key);
        return value || null;
    } catch (error) {
        console.error(`Error al obtener credencial segura (${key}):`, error.message);
        return null;
    }
}

/**
 * Elimina una credencial del keychain del sistema operativo.
 * @param {string} key - Clave de la credencial (usar CREDENTIAL_KEYS)
 * @returns {Promise<boolean>} true si se eliminó correctamente
 */
async function deleteSecureCredential(key) {
    try {
        return await keytar.deletePassword(SERVICE_NAME, key);
    } catch (error) {
        console.error(`Error al eliminar credencial segura (${key}):`, error.message);
        return false;
    }
}

/**
 * Migra las credenciales de Azure desde Configstore al keychain seguro.
 * Esta función se ejecuta automáticamente y es idempotente (segura de ejecutar múltiples veces).
 * @returns {Promise<boolean>} true si se realizó la migración, false si no había nada que migrar
 */
async function migrateFromConfigstore() {
    try {
        // Obtener configuración de Azure desde Configstore
        const storedAzureConfig = configStore.get(AZURE_CONFIG_KEY);

        if (!storedAzureConfig || typeof storedAzureConfig !== 'object') {
            return false; // No hay nada que migrar
        }

        let migrated = false;

        // Migrar cada campo si existe
        const migrations = [
            { oldKey: 'pat', newKey: CREDENTIAL_KEYS.AZURE_PAT },
            { oldKey: 'organization', newKey: CREDENTIAL_KEYS.AZURE_ORGANIZATION },
            { oldKey: 'project', newKey: CREDENTIAL_KEYS.AZURE_PROJECT },
            { oldKey: 'team', newKey: CREDENTIAL_KEYS.AZURE_TEAM },
            { oldKey: 'user', newKey: CREDENTIAL_KEYS.AZURE_USER },
        ];

        for (const { oldKey, newKey } of migrations) {
            const value = storedAzureConfig[oldKey];
            if (value && typeof value === 'string' && value.trim()) {
                // Verificar si ya existe en el keychain
                const existing = await getSecureCredential(newKey);
                if (!existing) {
                    await setSecureCredential(newKey, value);
                    migrated = true;
                }
            }
        }

        // Si se migró algo, eliminar la configuración antigua de Configstore
        if (migrated) {
            configStore.delete(AZURE_CONFIG_KEY);
            console.log('[OK] Credenciales migradas al almacenamiento seguro del sistema.');
        }

        return migrated;
    } catch (error) {
        console.error('Error durante la migración de credenciales:', error.message);
        // No lanzamos el error para no interrumpir el flujo de la aplicación
        return false;
    }
}

/**
 * Guarda la configuración completa de Azure en el keychain seguro.
 * @param {Object} config - Objeto con las propiedades de configuración de Azure
 * @param {string} [config.pat] - Personal Access Token
 * @param {string} [config.organization] - Organización de Azure DevOps
 * @param {string} [config.project] - Proyecto de Azure DevOps
 * @param {string} [config.team] - Equipo de Azure DevOps
 * @param {string} [config.user] - Usuario de Azure DevOps
 * @returns {Promise<void>}
 */
async function setSecureAzureConfig(config = {}) {
    const entries = [
        { key: CREDENTIAL_KEYS.AZURE_PAT, value: config.pat },
        { key: CREDENTIAL_KEYS.AZURE_ORGANIZATION, value: config.organization },
        { key: CREDENTIAL_KEYS.AZURE_PROJECT, value: config.project },
        { key: CREDENTIAL_KEYS.AZURE_TEAM, value: config.team },
        { key: CREDENTIAL_KEYS.AZURE_USER, value: config.user },
    ];

    for (const { key, value } of entries) {
        if (value && typeof value === 'string' && value.trim()) {
            await setSecureCredential(key, value);
        }
    }
}

/**
 * Obtiene la configuración completa de Azure desde el keychain seguro.
 * Intenta migrar automáticamente desde Configstore si es necesario.
 * @returns {Promise<Object>} Objeto con la configuración de Azure
 */
async function getSecureAzureConfig() {
    // Intentar migración automática
    await migrateFromConfigstore();

    // Obtener credenciales del keychain
    const [pat, organization, project, team, user] = await Promise.all([
        getSecureCredential(CREDENTIAL_KEYS.AZURE_PAT),
        getSecureCredential(CREDENTIAL_KEYS.AZURE_ORGANIZATION),
        getSecureCredential(CREDENTIAL_KEYS.AZURE_PROJECT),
        getSecureCredential(CREDENTIAL_KEYS.AZURE_TEAM),
        getSecureCredential(CREDENTIAL_KEYS.AZURE_USER),
    ]);

    return {
        pat,
        organization,
        project,
        team,
        user,
    };
}

/**
 * Elimina todas las credenciales de Azure del keychain seguro.
 * @returns {Promise<void>}
 */
async function clearSecureAzureConfig() {
    await Promise.all([
        deleteSecureCredential(CREDENTIAL_KEYS.AZURE_PAT),
        deleteSecureCredential(CREDENTIAL_KEYS.AZURE_ORGANIZATION),
        deleteSecureCredential(CREDENTIAL_KEYS.AZURE_PROJECT),
        deleteSecureCredential(CREDENTIAL_KEYS.AZURE_TEAM),
        deleteSecureCredential(CREDENTIAL_KEYS.AZURE_USER),
    ]);
}

module.exports = {
    CREDENTIAL_KEYS,
    setSecureCredential,
    getSecureCredential,
    deleteSecureCredential,
    setSecureAzureConfig,
    getSecureAzureConfig,
    clearSecureAzureConfig,
    migrateFromConfigstore,
};
