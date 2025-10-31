/**
 * Convierte una cadena en un slug amigable para usar en nombres de ramas.
 * Se eliminan caracteres no deseados y se sustituyen espacios por guiones.
 * @param {string} segment - Texto original proporcionado por el usuario.
 * @returns {string} Cadena procesada lista para integrarse como segmento de la rama.
 */
function slugifySegment(segment) {
  if (!segment) {
    return '';
  }

  return segment
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = {
  slugifySegment,
};
