const { slugifySegment } = require('./textHelpers');

// Constantes de validación según las mejores prácticas de Git
const MAX_BRANCH_NAME_LENGTH = 255; // Límite práctico de Git
const MAX_SEGMENT_LENGTH = 50; // Límite recomendado por segmento para legibilidad
const MIN_SEGMENT_LENGTH = 1;

// Nombres reservados que no deben usarse en ramas (en minúsculas para comparación)
const RESERVED_NAMES = ['head', 'master', 'main', 'develop', 'release', 'hotfix'];

// Caracteres especiales problemáticos que slugify podría no manejar completamente
const PROBLEMATIC_CHARS = /[~^:?*\[\]\\@{}<>|'"`;()&$!%]/;

/**
 * Valida que un segmento no contenga caracteres especiales problemáticos antes del slugify.
 * @param {string} segment - Segmento a validar.
 * @param {string} segmentName - Nombre del segmento para mensajes de error.
 * @throws {Error} Si el segmento contiene caracteres problemáticos.
 */
function validateSpecialCharacters(segment, segmentName) {
  if (PROBLEMATIC_CHARS.test(segment)) {
    const problematicChars = segment.match(PROBLEMATIC_CHARS).join(', ');
    throw new Error(
      `El ${segmentName} contiene caracteres especiales no permitidos: ${problematicChars}. ` +
      'Usa solo letras, números, espacios y guiones.'
    );
  }
}

/**
 * Valida la longitud de un segmento procesado.
 * @param {string} segment - Segmento procesado a validar.
 * @param {string} segmentName - Nombre del segmento para mensajes de error.
 * @throws {Error} Si el segmento excede la longitud máxima.
 */
function validateSegmentLength(segment, segmentName) {
  if (segment.length > MAX_SEGMENT_LENGTH) {
    throw new Error(
      `El ${segmentName} es demasiado largo (${segment.length} caracteres). ` +
      `El máximo permitido es ${MAX_SEGMENT_LENGTH} caracteres.`
    );
  }

  if (segment.length < MIN_SEGMENT_LENGTH) {
    throw new Error(
      `El ${segmentName} es demasiado corto. Debe tener al menos ${MIN_SEGMENT_LENGTH} carácter.`
    );
  }
}

/**
 * Valida que un segmento individual no sea un nombre reservado (antes del slugify).
 * @param {string} segment - Segmento a validar.
 * @param {string} segmentName - Nombre del segmento para mensajes de error.
 * @throws {Error} Si el segmento es un nombre reservado.
 */
function validateReservedName(segment, segmentName) {
  if (RESERVED_NAMES.includes(segment.toLowerCase().trim())) {
    throw new Error(
      `El ${segmentName} "${segment}" está reservado y no puede usarse. ` +
      `Nombres reservados: ${RESERVED_NAMES.join(', ')}.`
    );
  }
}

/**
 * Valida que el nombre de la rama no sea un nombre reservado.
 * @param {string} branchName - Nombre completo de la rama.
 * @throws {Error} Si el nombre es reservado.
 */
function validateReservedNames(branchName) {
  const segments = branchName.split('/');

  for (const segment of segments) {
    if (RESERVED_NAMES.includes(segment.toLowerCase())) {
      throw new Error(
        `El nombre "${segment}" está reservado y no puede usarse en nombres de rama. ` +
        `Nombres reservados: ${RESERVED_NAMES.join(', ')}.`
      );
    }
  }
}


/**
 * Valida que no haya separadores consecutivos o al inicio/final.
 * @param {string} branchName - Nombre completo de la rama.
 * @throws {Error} Si hay separadores consecutivos o mal posicionados.
 */
function validateSeparators(branchName) {
  if (branchName.includes('//')) {
    throw new Error('El nombre de la rama no puede contener barras consecutivas (//).');
  }

  if (branchName.startsWith('/') || branchName.endsWith('/')) {
    throw new Error('El nombre de la rama no puede comenzar ni terminar con una barra (/).');
  }

  if (branchName.includes('--')) {
    throw new Error('El nombre de la rama no puede contener guiones consecutivos (--).');
  }
}

/**
 * Genera el nombre final de la rama a partir de la combinación de alias, tipo y descriptor.
 * @param {Object} params - Valores que intervienen en el armado del nombre de la rama.
 * @param {string} params.userAlias - Alias que representa al usuario responsable del cambio.
 * @param {string} params.branchType - Tipo de rama seleccionado (feature, bugfix, etc.).
 * @param {string} params.descriptor - Descripción o identificador del ticket asociado.
 * @returns {string} Nombre de rama listo para ser utilizado en Git.
 * @throws {Error} Si alguna validación falla.
 */
function formatBranchName({ userAlias, branchType, descriptor }) {
  // Validar nombres reservados ANTES del slugify (para capturar variaciones de mayúsculas)
  validateReservedName(userAlias, 'alias');
  validateReservedName(branchType, 'tipo de rama');
  validateReservedName(descriptor, 'descriptor');

  // Validar caracteres especiales ANTES del slugify
  validateSpecialCharacters(userAlias, 'alias');
  validateSpecialCharacters(branchType, 'tipo de rama');
  validateSpecialCharacters(descriptor, 'descriptor');

  // Validar guiones consecutivos ANTES del slugify (porque slugify los elimina)
  if (userAlias.includes('--') || branchType.includes('--') || descriptor.includes('--')) {
    throw new Error('Los segmentos no pueden contener guiones consecutivos (--).');
  }

  // Procesar segmentos con slugify
  const aliasSegment = slugifySegment(userAlias);
  const typeSegment = slugifySegment(branchType);
  const descriptorSegment = slugifySegment(descriptor);

  // Validar que los segmentos no estén vacíos después del slugify
  if (!aliasSegment) {
    throw new Error('No fue posible determinar un alias válido. Configura uno con "gitbrancher config --alias <alias>".');
  }

  if (!typeSegment) {
    throw new Error('El tipo de rama seleccionado no es válido.');
  }

  if (!descriptorSegment) {
    throw new Error('El descriptor proporcionado no generó un nombre válido. Intenta utilizar letras, números o guiones.');
  }

  // Validar longitud de cada segmento
  validateSegmentLength(aliasSegment, 'alias');
  validateSegmentLength(typeSegment, 'tipo de rama');
  validateSegmentLength(descriptorSegment, 'descriptor');

  // Construir el nombre completo de la rama
  const branchName = `${aliasSegment}/${typeSegment}/${descriptorSegment}`;

  // Validar longitud total del nombre de la rama
  if (branchName.length > MAX_BRANCH_NAME_LENGTH) {
    throw new Error(
      `El nombre de la rama es demasiado largo (${branchName.length} caracteres). ` +
      `El máximo permitido es ${MAX_BRANCH_NAME_LENGTH} caracteres. ` +
      'Intenta usar un descriptor más corto.'
    );
  }

  // Validar nombres reservados
  validateReservedNames(branchName);

  // Validar separadores
  validateSeparators(branchName);

  return branchName;
}

module.exports = {
  formatBranchName,
};
