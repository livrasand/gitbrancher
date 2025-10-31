# Documentación de GitBrancher

## Propósito del proyecto
GitBrancher es un CLI con branding moderno que estandariza la creación de ramas Git. El objetivo principal es aplicar convenciones claras y consistentes que faciliten el trabajo colaborativo y la automatización dentro de pipelines CI/CD.

## Características clave
- Selección de tipos de ramas predefinidos con descripciones guiadas.
- Generación automática del alias del usuario (Git, `.gitbrancherrc`, variable de entorno o Configstore).
- Creación de la rama en Git empleando `simple-git` para garantizar compatibilidad multiplataforma.
- Configuración persistente para personalizar el alias del autor.
- Experiencia visual con `figlet`, `boxen` y `chalk` para ofrecer una CLI clara y atractiva.

## Scripts de npm
- `npm start`: ejecuta la CLI en modo interactivo.
- `npm run help`: muestra la ayuda enriquecida.
- `npm test`: placeholder para futuras pruebas.

Consulta [architecture.md](architecture.md) para un desglose técnico más profundo.
