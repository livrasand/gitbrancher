const simpleGit = require('simple-git');

/**
 * Crea una instancia de cliente Git apuntando al directorio de trabajo actual.
 * @returns {import('simple-git').SimpleGit} Cliente simple-git listo para ejecutar comandos.
 */
function createGitClient() {
  return simpleGit({
    baseDir: process.cwd(),
    binary: 'git',
  });
}

/**
 * Obtiene el nombre de usuario configurado en Git mediante `git config user.name`.
 * @returns {Promise<string | null>} Nombre de usuario o null si no está configurado o ocurre un error.
 */
async function getGitUserName() {
  const git = createGitClient();
  try {
    const rawResult = await git.raw(['config', 'user.name']);
    const trimmed = rawResult.trim();
    return trimmed || null;
  } catch (error) {
    return null;
  }
}

/**
 * Verifica la existencia de una rama local con el nombre indicado y la crea si no existe.
 * @param {string} branchName - Nombre completo de la rama a crear.
 * @returns {Promise<void>} Una promesa que se resuelve cuando la rama ha sido creada y checkout realizada.
 * @throws {Error} Cuando la rama ya existe o Git devuelve un error.
 */
async function createBranch(branchName) {
  if (!branchName || !branchName.trim()) {
    throw new Error('El nombre de la rama no puede estar vacío.');
  }

  const git = createGitClient();

  try {
    const branchSummary = await git.branchLocal();

    if (branchSummary.all.includes(branchName)) {
      throw new Error(`La rama "${branchName}" ya existe en el repositorio local.`);
    }

    await git.checkoutLocalBranch(branchName);
  } catch (error) {
    throw new Error(`No fue posible crear la rama "${branchName}": ${error.message}`);
  }
}


/**
 * Obtiene el nombre de la rama actual en el repositorio local.
 * @returns {Promise<string>} Nombre de la rama actual.
 * @throws {Error} Si no se puede determinar la rama actual.
 */
async function getCurrentBranch() {
  const git = createGitClient();
  try {
    const branchSummary = await git.branchLocal();
    return branchSummary.current;
  } catch (error) {
    throw new Error(`No fue posible determinar la rama actual: ${error.message}`);
  }
}

module.exports = {
  createGitClient,
  getGitUserName,
  createBranch,
  getCurrentBranch,
};
