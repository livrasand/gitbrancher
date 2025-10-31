# GitBrancher

CLI para crear ramas Git con nombres estandarizados según el flujo de trabajo.

## Instalación

```bash
npm i @livrasand/gitbrancher
```

## Uso rápido

```bash
gitbrancher new
```

## Comandos principales

- `gitbrancher new`: crea una nueva rama con flujo interactivo. Pregunta por el tipo de rama y descriptor; si detecta credenciales de Azure DevOps, ofrece usar tu backlog.
- `gitbrancher list-types`: muestra los tipos de ramas disponibles y su descripción.
- `gitbrancher config`: administra alias y credenciales. Usa `--alias`, `--clear-alias`, `--azure`, `--clear-azure`.
- `gitbrancher help`: despliega la ayuda con ejemplos.

## Conexión con Azure DevOps

GitBrancher puede consultar tu backlog personal en Azure DevOps para crear ramas basadas en work items.

1. **Configura tus credenciales**
   ```bash
   gitbrancher config --azure
   ```
   Proporciona organización, proyecto y token personal (PAT). El asistente también acepta un equipo específico y tu usuario. Los datos se almacenan localmente usando Configstore.

2. **(Opcional) Variables de entorno**
   Puedes definir `GITBRANCHER_AZURE_ORG`, `GITBRANCHER_AZURE_PROJECT`, `GITBRANCHER_AZURE_PAT`, etc. como alternativa o complemento al asistente.

3. **Ejecuta el flujo interactivo**
   ```bash
   gitbrancher new
   ```
   Si hay credenciales válidas, se mostrará una lista de work items asignados. Al elegir uno:
   - Se sugiere el tipo de rama con base en el tipo de work item (bug → bugfix, feature → feature, etc.).
   - El descriptor se prellena con `<ID>-<Título>` para agilizar la creación de ramas.
   - Puedes modificar cualquiera de los campos antes de confirmar.

4. **Resultado**
   Se crea y hace checkout de la rama con formato `<alias>/<tipo>/<descriptor>`, lista para trabajar.

## Documentación adicional

Consulta la carpeta [docs/](docs/) para obtener información detallada sobre la arquitectura, configuración y futuras integraciones.
