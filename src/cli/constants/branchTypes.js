const DEFAULT_BRANCH_TYPES = [
  {
    name: 'feature',
    description: 'Nueva funcionalidad o mejora dentro del ciclo de desarrollo',
    prefix: 'feature',
  },
  {
    name: 'bugfix',
    description: 'Corrección de un bug detectado antes de un release estable',
    prefix: 'bugfix',
  },
  {
    name: 'hotfix',
    description: 'Corrección urgente aplicada directamente en producción',
    prefix: 'hotfix',
  },
  {
    name: 'release',
    description: 'Preparación de un paquete listo para ser publicado',
    prefix: 'release',
  },
  {
    name: 'experiment',
    description: 'Pruebas o prototipos exploratorios que aún no son oficiales',
    prefix: 'experiment',
  },
  {
    name: 'test',
    description: 'Cambios destinados exclusivamente a escenarios de prueba',
    prefix: 'test',
  },
  {
    name: 'chore',
    description: 'Tareas menores de mantenimiento o soporte',
    prefix: 'chore',
  },
  {
    name: 'docs',
    description: 'Actualizaciones o creación de documentación',
    prefix: 'docs',
  },
  {
    name: 'refactor',
    description: 'Reestructuración de código sin alterar el comportamiento',
    prefix: 'refactor',
  },
  {
    name: 'ci',
    description: 'Cambios relacionados con la configuración de CI/CD',
    prefix: 'ci',
  },
  {
    name: 'build',
    description: 'Ajustes al proceso de construcción o empaquetado',
    prefix: 'build',
  },
];

module.exports = {
  DEFAULT_BRANCH_TYPES,
};
