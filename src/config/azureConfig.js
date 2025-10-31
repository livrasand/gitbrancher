const ConfigstoreModule = require('configstore');
const Configstore = ConfigstoreModule.default || ConfigstoreModule;
const dotenv = require('dotenv');

const { loadLocalRcConfig, loadGlobalRcConfig } = require('./rcLoader');

dotenv.config();

const CONFIG_NAMESPACE = 'gitbrancher';
const AZURE_CONFIG_KEY = 'azure';

const configStore = new Configstore(CONFIG_NAMESPACE);

function getStoredAzureConfig() {
  return configStore.get(AZURE_CONFIG_KEY) || {};
}

function setStoredAzureConfig(partialConfig = {}) {
  const current = getStoredAzureConfig();
  const sanitizedEntries = Object.entries(partialConfig)
    .filter(([_, value]) => typeof value === 'string' && value.trim().length > 0)
    .map(([key, value]) => [key, value.trim()]);

  if (!sanitizedEntries.length) {
    return;
  }

  const merged = { ...current, ...Object.fromEntries(sanitizedEntries) };
  configStore.set(AZURE_CONFIG_KEY, merged);
}

function clearStoredAzureConfig() {
  configStore.delete(AZURE_CONFIG_KEY);
}

function extractAzureConfigFromRc(rcConfig) {
  if (!rcConfig) {
    return null;
  }

  if (typeof rcConfig === 'object' && rcConfig.azure) {
    return rcConfig.azure;
  }

  const possibleKeys = ['azure.organization', 'azure.project', 'azure.team', 'azure.user', 'azure.pat'];
  const hasNamespacedKeys = possibleKeys.some((key) => Object.prototype.hasOwnProperty.call(rcConfig, key));

  if (hasNamespacedKeys) {
    const azure = {};
    possibleKeys.forEach((key) => {
      if (rcConfig[key]) {
        const shortKey = key.split('.')[1];
        azure[shortKey] = rcConfig[key];
      }
    });
    return azure;
  }

  return null;
}

function getEffectiveAzureConfig() {
  const localRc = extractAzureConfigFromRc(loadLocalRcConfig());
  const globalRc = extractAzureConfigFromRc(loadGlobalRcConfig());
  const stored = getStoredAzureConfig();

  return {
    organization: process.env.GITBRANCHER_AZURE_ORG || localRc?.organization || globalRc?.organization || stored.organization || null,
    project: process.env.GITBRANCHER_AZURE_PROJECT || localRc?.project || globalRc?.project || stored.project || null,
    team: process.env.GITBRANCHER_AZURE_TEAM || localRc?.team || globalRc?.team || stored.team || null,
    user: process.env.GITBRANCHER_AZURE_USER || localRc?.user || globalRc?.user || stored.user || null,
    pat: process.env.GITBRANCHER_AZURE_PAT || localRc?.pat || globalRc?.pat || stored.pat || null,
  };
}

function hasAzureCredentials(config = getEffectiveAzureConfig()) {
  return Boolean(config.organization && config.project && config.pat);
}

function setAzureConfig(partialConfig = {}) {
  setStoredAzureConfig(partialConfig);
}

function clearAzureConfig() {
  clearStoredAzureConfig();
}

module.exports = {
  getEffectiveAzureConfig,
  hasAzureCredentials,
  setAzureConfig,
  clearAzureConfig,
};
