<p align="center">
  <img width="446" height="128" alt="ascii-art-text" src="https://github.com/user-attachments/assets/068918c1-00c4-4613-b451-069a836f4a0d" />
  <br />
  <a href="https://nodei.co/npm/@livrasand/gitbrancher/">
    <img src="https://nodei.co/npm/@livrasand/gitbrancher.svg?data=d,s" alt="NPM">
  </a>
  <br />
  <img
    src="https://img.shields.io/npm/d18m/%40livrasand%2Fgitbrancher?logo=npm&color=red"
    alt="NPM Downloads"
  />
<img 
  src="https://custom-icon-badges.demolab.com/badge/Azure%20DevOps-Compatible-blue?logo=microsoft-devops"
  alt="Azure DevOps"/>
  <img 
  src="https://img.shields.io/badge/GitHub-Coming%20Soon-lightgrey?logo=github"
  alt="GitHub – Coming Soon"/>
<img 
  src="https://img.shields.io/badge/GitLab-Coming%20Soon-lightgrey?logo=gitlab"
  alt="GitLab – Coming Soon"/>
<img 
  src="https://img.shields.io/badge/Jira-Coming%20Soon-lightgrey?logo=jira"
  alt="Jira – Coming Soon"/>
</p>


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
   Proporciona organización, proyecto y token personal (PAT). El asistente también acepta un equipo específico y tu usuario. 
   
   🔐 **Seguridad**: Las credenciales se almacenan de forma segura en el keychain del sistema operativo (Keychain en macOS, Credential Manager en Windows, libsecret en Linux), protegiendo tu PAT con encriptación del OS.

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
