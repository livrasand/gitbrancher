const ConfigstoreModule = require('configstore');
const Configstore = ConfigstoreModule.default || ConfigstoreModule;
const dotenv = require('dotenv');
const { getGitUserName } = require('../git/gitService');
const { loadLocalRcConfig, loadGlobalRcConfig } = require('./rcLoader');

const { getEffectiveAzureConfig, setAzureConfig, clearAzureConfig } = require('./azureConfig');

dotenv.config();

const CONFIG_NAMESPACE = 'gitbrancher';
const CONFIG_ALIAS_KEY = 'alias';

const configStore = new Configstore(CONFIG_NAMESPACE);

function loadAliasFromRc(config) {
  if (!config) {
    return null;
  }

  if (typeof config === 'string') {
    return config;
  }

  return config.alias || null;
}

/**
 * Devuelve el alias guardado en Configstore si existe.
 * @returns {string | null} Alias persistido mediante Configstore o null si aún no se ha definido.
 */
function getStoredAlias() {
  const alias = configStore.get(CONFIG_ALIAS_KEY);
  return alias ? alias.trim() : null;
}

/**
 * Persiste un alias en Configstore para reutilizarlo en futuras ejecuciones.
 * @param {string} alias - Alias preferido por el usuario.
 */
function setStoredAlias(alias) {
  if (!alias || !alias.trim()) {
    return;
  }
  configStore.set(CONFIG_ALIAS_KEY, alias.trim());
}

/**
 * Elimina el alias almacenado en Configstore.
 */
function clearStoredAlias() {
  configStore.delete(CONFIG_ALIAS_KEY);
}

/**
 * Determina el alias efectivo siguiendo el orden de prioridad:
 * 1. Variable de entorno GITBRANCHER_ALIAS.
 * 2. Archivo .gitbrancherrc local.
 * 3. Archivo .gitbrancherrc global.
 * 4. Alias almacenado en Configstore.
 * 5. Valor de git config user.name.
 * En caso de obtener un alias desde Git y no existir uno persistido, se almacena para futuros usos.
 * @returns {Promise<string>} Alias resultante para utilizar en los nombres de rama.
 */
async function resolveUserAlias() {
  const envAlias = process.env.GITBRANCHER_ALIAS;
  if (envAlias && envAlias.trim()) {
    return envAlias.trim();
  }

  const localAlias = loadAliasFromRc(loadLocalRcConfig());
  if (localAlias && localAlias.trim()) {
    return localAlias.trim();
  }

  const globalAlias = loadAliasFromRc(loadGlobalRcConfig());
  if (globalAlias && globalAlias.trim()) {
    return globalAlias.trim();
  }

  const storedAlias = getStoredAlias();
  if (storedAlias && storedAlias.trim()) {
    return storedAlias.trim();
  }

  const gitUserName = await getGitUserName();
  if (gitUserName && gitUserName.trim()) {
    const trimmed = gitUserName.trim();
    setStoredAlias(trimmed);
    return trimmed;
  }

  return 'unknown';
}

module.exports = {
  resolveUserAlias,
  setStoredAlias,
  clearStoredAlias,
  getStoredAlias,
  loadLocalRcConfig,
  loadGlobalRcConfig,
  getEffectiveAzureConfig,
  setAzureConfig,
  clearAzureConfig,
};
