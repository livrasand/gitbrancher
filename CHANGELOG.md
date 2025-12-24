# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [1.1.0] - 2024-12-24

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

[1.0.0]: https://github.com/livrasand/gitbrancher/releases/tag/v1.0.0
