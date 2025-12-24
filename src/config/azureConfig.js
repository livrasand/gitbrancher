const dotenv = require('dotenv');

const { loadLocalRcConfig, loadGlobalRcConfig } = require('./rcLoader');
const {
  getSecureAzureConfig,
  setSecureAzureConfig,
  clearSecureAzureConfig,
} = require('./secureCredentials');

dotenv.config();

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

async function getEffectiveAzureConfig() {
  const localRc = extractAzureConfigFromRc(loadLocalRcConfig());
  const globalRc = extractAzureConfigFromRc(loadGlobalRcConfig());

  // Obtener credenciales seguras del keychain (con migración automática)
  const stored = await getSecureAzureConfig();

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

async function setAzureConfig(partialConfig = {}) {
  await setSecureAzureConfig(partialConfig);
}

async function clearAzureConfig() {
  await clearSecureAzureConfig();
}

module.exports = {
  getEffectiveAzureConfig,
  hasAzureCredentials,
  setAzureConfig,
  clearAzureConfig,
};
