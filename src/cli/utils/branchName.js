const { slugifySegment } = require('./textHelpers');

/**
 * Genera el nombre final de la rama a partir de la combinación de alias, tipo y descriptor.
 * @param {Object} params - Valores que intervienen en el armado del nombre de la rama.
 * @param {string} params.userAlias - Alias que representa al usuario responsable del cambio.
 * @param {string} params.branchType - Tipo de rama seleccionado (feature, bugfix, etc.).
 * @param {string} params.descriptor - Descripción o identificador del ticket asociado.
 * @returns {string} Nombre de rama listo para ser utilizado en Git.
 */
function formatBranchName({ userAlias, branchType, descriptor }) {
  const aliasSegment = slugifySegment(userAlias);
  const typeSegment = slugifySegment(branchType);
  const descriptorSegment = slugifySegment(descriptor);

  if (!aliasSegment) {
    throw new Error('No fue posible determinar un alias válido. Configura uno con "gitbrancher config --alias <alias>".');
  }

  if (!typeSegment) {
    throw new Error('El tipo de rama seleccionado no es válido.');
  }

  if (!descriptorSegment) {
    throw new Error('El descriptor proporcionado no generó un nombre válido. Intenta utilizar letras, números o guiones.');
  }

  return `${aliasSegment}/${typeSegment}/${descriptorSegment}`;
}

module.exports = {
  formatBranchName,
};
