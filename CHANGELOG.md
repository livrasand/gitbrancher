# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [2.0.1] - 2026-01-01

### 🛠️ Correcciones y Mejoras
- **Estabilidad de la Visualización HTML**: Corregidos errores que causaban el cierre inesperado de la visualización debido a caracteres especiales en el contenido del diff.
- **Protección de Datos**: Los datos del grafo ahora se incrustan usando Base64 en lugar de inyección directa de JSON, evitando errores de sintaxis en el navegador.
- **Selectores de Cytoscape**: Corregidos los selectores de nodos para usar el escape adecuado, resolviendo problemas de renderizado en casos borde.
- **Refactorización de JavaScript**: El código generado para la visualización ahora es más robusto y fácil de mantener, eliminando concatenaciones de strings frágiles.
- **Manejo de Créditos AI**: Mejorada la retroalimentación y el manejo de errores al consumir créditos, incluyendo información detallada para diagnóstico.

## [2.0.0] - 2026-01-01

### ✨ Nuevas Funciones
- **Análisis de Impacto con IA**: Nuevo comando `pr analyze` que utiliza inteligencia artificial para analizar el impacto de los Pull Requests.
  - Opciones `--ai` (análisis estándar) y `--ai-full` (análisis profundo).
  - Información detallada por archivo, dependencias afectadas y contexto del cambio.
- **Visualización Interactiva Avanzada**: Generación automática de gráficos de impacto interactivos.
  - Detección automática de rama base.
  - Diffs integrados con resaltado de sintaxis y copiado rápido.
  - Vista detallada de archivos afectados y números de línea.
  - Exportación a formato Mermaid.
- **Autenticación con GitHub OAuth**: Nuevo sistema moderno de inicio de sesión que reemplaza el uso de email/password.
  - Apertura automática del navegador para autenticación.
  - Servidor local para captura automática de token.
  - Soporte para parámetro `--token` en flujos automatizados.
- **Sistema de Créditos AI**: Nuevo comando `credits` para consultar el balance disponible para análisis de IA.
- **Experiencia CLI Consistente**: Reemplazo total de emojis por indicadores de estado basados en texto (`[SUCCESS]`, `[ERROR]`, `[WARNING]`, etc.) para mayor compatibilidad con todas las terminales y entornos CI/CD.

### ⚠️ Cambios Disruptivos (Breaking Changes)
- **Eliminación de Auth Tradicional**: Ya no se soporta el inicio de sesión con email y contraseña; ahora es 100% GitHub OAuth.
- **Requisito de Auth para IA**: El análisis de IA requiere inicio de sesión obligatorio.
- **Formato de Salida**: El formato de los mensajes en consola ha cambiado radicalmente para ser compatible con logs.

### 🔧 Mejoras Técnicas
- Servidor HTTP local integrado para callbacks de OAuth.
- Estandarización de secciones de análisis en CLI y HTML.
- Mejorada la separación entre la lógica de CLI, visualización y backend.



## [1.2.0] - 2025-12-24

### ✨ Mejoras
- **UX de Branching mejorada**: Ahora el sistema es mucho más tolerante y dinámico.
- **Límite Visual en Tiempo Real**: Implementado `inquirer-maxlength-input-prompt` para limitar visualmente la entrada del descriptor a 50 caracteres.
- **Truncado Automático de Segmentos**: Los segmentos (alias, tipo, descriptor) ahora se truncan automáticamente a un máximo de 50 caracteres (`MAX_SEGMENT_LENGTH`) en lugar de lanzar un error que interrumpa el flujo del usuario.
- **Sugerencias Inteligentes**: Las sugerencias automáticas provenientes de Azure DevOps ahora se pre-truncan para ajustarse al límite recomendado.
- **Configuración Centralizada**: Se centralizó el límite de caracteres (`MAX_SEGMENT_LENGTH`) para facilitar el mantenimiento futuro.

### 📦 Dependencias
- Añadido `inquirer-maxlength-input-prompt` para una mejor experiencia interactiva.

## [1.1.0] - 2025-12-24 (Corregido fecha 2025)

### 🔐 Seguridad

#### Añadido
- **Almacenamiento seguro de credenciales**: Las credenciales de Azure DevOps (especialmente el PAT) ahora se almacenan de forma segura en el keychain del sistema operativo en lugar de Configstore sin encriptación.
  - macOS: Keychain Access
  - Windows: Credential Manager
  - Linux: libsecret/gnome-keyring
- **Migración automática**: Las credenciales existentes en Configstore se migran automáticamente al keychain seguro en la primera ejecución después de actualizar.
- **Script de migración manual**: Nuevo comando `npm run migrate` para verificar o forzar la migración de credenciales.
- **Documentación de seguridad**: Nueva guía completa en `docs/SECURITY_MIGRATION.md` sobre la migración y mejores prácticas de seguridad.

#### Cambiado
- `getEffectiveAzureConfig()` ahora es asíncrona y obtiene credenciales del keychain seguro
- `setAzureConfig()` ahora es asíncrona y almacena credenciales en el keychain seguro
- `clearAzureConfig()` ahora es asíncrona y elimina credenciales del keychain seguro
- Todas las llamadas a estas funciones actualizadas para usar `await`

#### Dependencias
- Añadido `keytar` para acceso seguro al keychain del sistema operativo

### 📚 Documentación
- Actualizado README.md para reflejar el nuevo sistema de almacenamiento seguro
- Añadido `docs/SECURITY_MIGRATION.md` con guía completa de migración
- Mejorada documentación de configuración de Azure DevOps

### 🔄 Compatibilidad
- **100% compatible con versiones anteriores**: Los usuarios existentes no necesitan hacer nada, la migración es automática
- Mantiene la jerarquía de configuración: env vars > .rc local > .rc global > keychain
- Los archivos `.gitbrancherrc` siguen siendo compatibles

## [1.0.1] - 2025-12-24

### Añadido
- Comando `info`/`status` para mostrar información de la rama actual
- Validación mejorada de nombres de rama
- Manejo robusto de errores en `fetchAssignedWorkItems`

### Cambiado
- Refactorización de la lógica de creación de ramas
- Mejoras en el descriptor de nombres de rama

## [1.0.0] - 2025-10-31

### Añadido
- Versión inicial de GitBrancher
- Comando `new` para crear ramas con convención estandarizada
- Comando `list-types` para mostrar tipos de rama disponibles
- Comando `config` para gestionar alias y credenciales
- Integración con Azure DevOps para seleccionar work items
- Soporte para archivos `.gitbrancherrc` (local y global)
- Soporte para variables de entorno

---

[2.0.1]: https://github.com/livrasand/gitbrancher/releases/tag/v2.0.1
[2.0.0]: https://github.com/livrasand/gitbrancher/releases/tag/v2.0.0
[1.2.0]: https://github.com/livrasand/gitbrancher/releases/tag/v1.2.0
[1.1.0]: https://github.com/livrasand/gitbrancher/releases/tag/v1.1.0
[1.0.1]: https://github.com/livrasand/gitbrancher/releases/tag/v1.0.1
[1.0.0]: https://github.com/livrasand/gitbrancher/releases/tag/v1.0.0
