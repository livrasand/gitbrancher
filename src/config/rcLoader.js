const fs = require('fs');
const os = require('os');
const path = require('path');

function parseRawContent(rawContent) {
  if (!rawContent || !rawContent.trim()) {
    return null;
  }

  const trimmed = rawContent.trim();

  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      return null;
    }
  }

  if (trimmed.includes('=')) {
    const result = {};
    trimmed.split(/\r?\n/).forEach((line) => {
      const currentLine = line.trim();
      if (!currentLine || currentLine.startsWith('#')) {
        return;
      }
      const [key, value] = currentLine.split('=').map((part) => part.trim());
      if (key && value) {
        result[key] = value;
      }
    });
    return result;
  }

  return { alias: trimmed };
}

function readRcFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const rawContent = fs.readFileSync(filePath, 'utf8');
    return parseRawContent(rawContent);
  } catch (error) {
    return null;
  }
}

function loadLocalRcConfig() {
  const localPath = path.join(process.cwd(), '.gitbrancherrc');
  return readRcFile(localPath);
}

function loadGlobalRcConfig() {
  const globalPath = path.join(os.homedir(), '.gitbrancherrc');
  return readRcFile(globalPath);
}

module.exports = {
  readRcFile,
  loadLocalRcConfig,
  loadGlobalRcConfig,
};
