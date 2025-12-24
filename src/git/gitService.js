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
 * Verifica si una rama existe en el repositorio remoto.
 * @param {string} branchName - Nombre de la rama a verificar.
 * @returns {Promise<boolean>} true si la rama existe en el remoto, false en caso contrario.
 */
async function checkRemoteBranchExists(branchName) {
  if (!branchName || !branchName.trim()) {
    return false;
  }

  const git = createGitClient();

  try {
    // Obtener lista de ramas remotas
    const remoteBranches = await git.branch(['-r']);

    // Verificar si existe la rama en origin
    const remoteBranchName = `origin/${branchName}`;
    return remoteBranches.all.includes(remoteBranchName);
  } catch (error) {
    // Si hay error al obtener ramas remotas (ej: sin conexión), retornar false
    // para no bloquear la creación de la rama local
    return false;
  }
}

/**
 * Verifica la existencia de una rama local con el nombre indicado y la crea si no existe.
 * @param {string} branchName - Nombre completo de la rama a crear.
 * @param {Object} options - Opciones de validación.
 * @param {boolean} options.checkRemote - Si debe validar contra ramas remotas (default: true).
 * @returns {Promise<void>} Una promesa que se resuelve cuando la rama ha sido creada y checkout realizada.
 * @throws {Error} Cuando la rama ya existe o Git devuelve un error.
 */
async function createBranch(branchName, options = { checkRemote: true }) {
  if (!branchName || !branchName.trim()) {
    throw new Error('El nombre de la rama no puede estar vacío.');
  }

  const git = createGitClient();

  try {
    const branchSummary = await git.branchLocal();

    if (branchSummary.all.includes(branchName)) {
      throw new Error(`La rama "${branchName}" ya existe en el repositorio local.`);
    }

    // Validar contra ramas remotas si está habilitado
    if (options.checkRemote) {
      const existsInRemote = await checkRemoteBranchExists(branchName);
      if (existsInRemote) {
        throw new Error(
          `La rama "${branchName}" ya existe en el repositorio remoto. ` +
          'Usa un nombre diferente o sincroniza con "git fetch".'
        );
      }
    }

    await git.checkoutLocalBranch(branchName);
  } catch (error) {
    // Re-lanzar errores personalizados tal cual
    if (error.message.includes('ya existe')) {
      throw error;
    }
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


/**
 * Sube la rama especificada al repositorio remoto (origin) y establece el upstream.
 * Equivalente a `git push -u origin <branchName>`.
 * @param {string} branchName - Nombre de la rama a subir.
 * @returns {Promise<void>}
 * @throws {Error} Si ocurre un error durante el push.
 */
async function pushBranch(branchName) {
  if (!branchName || !branchName.trim()) {
    throw new Error('El nombre de la rama no puede estar vacío para realizar push.');
  }

  const git = createGitClient();
  try {
    // push con -u (set-upstream) origin <branchName>
    await git.push(['-u', 'origin', branchName]);
  } catch (error) {
    throw new Error(`No fue posible subir la rama "${branchName}" al remoto: ${error.message}`);
  }
}

module.exports = {
  createGitClient,
  getGitUserName,
  createBranch,
  getCurrentBranch,
  pushBranch,
  checkRemoteBranchExists,
};
