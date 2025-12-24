# Mejora de Seguridad: Almacenamiento de Credenciales

## 🔐 Resumen

A partir de la versión 1.1.0, GitBrancher utiliza el **keychain del sistema operativo** para almacenar de forma segura el Personal Access Token (PAT) de Azure DevOps y otras credenciales sensibles, en lugar de almacenarlas sin encriptación en Configstore.

## ✨ Beneficios

### Antes (Configstore)
- ❌ PAT almacenado en texto plano en `~/.config/configstore/gitbrancher.json`
- ❌ Cualquier proceso con acceso al sistema de archivos podía leer el PAT
- ❌ Sin protección adicional del sistema operativo

### Ahora (Keychain)
- ✅ PAT encriptado por el sistema operativo
- ✅ Protegido por las políticas de seguridad del OS
- ✅ En macOS: integrado con Keychain Access
- ✅ En Windows: integrado con Credential Manager
- ✅ En Linux: integrado con libsecret/gnome-keyring

## 🔄 Migración Automática

**No necesitas hacer nada.** La migración es completamente automática:

1. La primera vez que ejecutes cualquier comando de GitBrancher después de actualizar, el sistema detectará si tienes credenciales en Configstore
2. Si las encuentra, las migrará automáticamente al keychain seguro
3. Una vez migradas, eliminará las credenciales del archivo de Configstore
4. Verás un mensaje de confirmación: `✓ Credenciales migradas al almacenamiento seguro del sistema.`

### Ejemplo de migración automática

```bash
$ gitbrancher new

✓ Credenciales migradas al almacenamiento seguro del sistema.

Vamos a crear una nueva rama siguiendo el flujo estandarizado.
...
```

## 🛠️ Migración Manual (Opcional)

Si deseas verificar o forzar la migración manualmente, puedes ejecutar:

```bash
node bin/migrate-credentials.js
```

Este script te mostrará:
- Si se encontraron credenciales para migrar
- Qué credenciales se migraron exitosamente
- El estado actual de tus credenciales

## 📋 Compatibilidad con Usuarios Existentes

### Si ya tienes GitBrancher instalado:

1. **Actualiza a la última versión:**
   ```bash
   npm update -g @livrasand/gitbrancher
   ```

2. **Ejecuta cualquier comando** (la migración será automática):
   ```bash
   gitbrancher config
   ```

3. **Verifica que tus credenciales funcionan:**
   ```bash
   gitbrancher new
   ```

### Si eres un nuevo usuario:

No necesitas hacer nada especial. Cuando configures tus credenciales con:

```bash
gitbrancher config --azure
```

Se almacenarán automáticamente de forma segura en el keychain del sistema.

## 🔍 Jerarquía de Configuración

El orden de prioridad para las credenciales de Azure DevOps es:

1. **Variables de entorno** (mayor prioridad)
   - `GITBRANCHER_AZURE_ORG`
   - `GITBRANCHER_AZURE_PROJECT`
   - `GITBRANCHER_AZURE_TEAM`
   - `GITBRANCHER_AZURE_USER`
   - `GITBRANCHER_AZURE_PAT`

2. **Archivo `.gitbrancherrc` local** (en el directorio del proyecto)

3. **Archivo `.gitbrancherrc` global** (en el home del usuario)

4. **Keychain del sistema** (almacenamiento seguro)

Esto significa que puedes:
- Usar variables de entorno para CI/CD
- Usar archivos `.gitbrancherrc` para configuración por proyecto
- Usar el keychain para configuración personal segura

## 🔒 Seguridad Adicional

### Recomendaciones

1. **Revoca PATs antiguos**: Si sospechas que tu PAT pudo haber sido comprometido cuando estaba en Configstore, revócalo y genera uno nuevo:
   - Ve a Azure DevOps → User Settings → Personal Access Tokens
   - Revoca el token antiguo
   - Genera un nuevo token
   - Actualiza en GitBrancher: `gitbrancher config --azure`

2. **Permisos mínimos**: Asegúrate de que tu PAT tenga solo los permisos necesarios:
   - `Work Items (Read)` - Para leer work items asignados
   - Evita dar permisos innecesarios

3. **Rotación de tokens**: Considera rotar tu PAT periódicamente (cada 3-6 meses)

### Verificar tus credenciales

Para ver el estado de tu configuración (sin mostrar el PAT):

```bash
gitbrancher config
```

Salida esperada:
```
Resumen de configuración:
  Alias efectivo: tu-alias
  Alias almacenado: tu-alias
  Azure organización: tu-organizacion
  Azure proyecto: tu-proyecto
  Azure equipo: Sin especificar
  Azure usuario: Sin especificar
  Azure PAT: Configurado (no se muestra por seguridad)
```

## 🐛 Solución de Problemas

### Error: "No se pudo guardar la credencial de forma segura"

**Causa**: El sistema operativo no tiene un keychain configurado o accesible.

**Solución**:
- **macOS**: Asegúrate de que Keychain Access esté funcionando correctamente
- **Linux**: Instala `libsecret` o `gnome-keyring`:
  ```bash
  # Ubuntu/Debian
  sudo apt-get install libsecret-1-dev
  
  # Fedora
  sudo dnf install libsecret-devel
  ```
- **Windows**: El Credential Manager debería estar disponible por defecto

### Error: "Autenticación fallida. El PAT puede ser inválido o haber expirado"

**Causa**: El PAT migrado puede estar corrupto o haber expirado.

**Solución**:
1. Limpia la configuración actual:
   ```bash
   gitbrancher config --clear-azure
   ```

2. Reconfigura con un nuevo PAT:
   ```bash
   gitbrancher config --azure
   ```

### Quiero volver a Configstore (no recomendado)

Si por alguna razón necesitas volver al sistema anterior:

1. Haz downgrade a la versión anterior:
   ```bash
   npm install -g @livrasand/gitbrancher@1.0.1
   ```

2. **Nota**: Esto no es recomendado por razones de seguridad.

## 📚 Recursos Adicionales

- [Documentación de keytar](https://github.com/atom/node-keytar)
- [Mejores prácticas de seguridad para PATs](https://docs.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate)
- [Reportar problemas de seguridad](https://github.com/livrasand/gitbrancher/blob/main/SECURITY.md)

## 🤝 Contribuciones

Si encuentras algún problema con la migración o tienes sugerencias para mejorar la seguridad, por favor:

1. Abre un issue en [GitHub Issues](https://github.com/livrasand/gitbrancher/issues)
2. Para problemas de seguridad críticos, sigue las instrucciones en [SECURITY.md](../SECURITY.md)

---

**Última actualización**: Diciembre 2024  
**Versión**: 1.1.0+
