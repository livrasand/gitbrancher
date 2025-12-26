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
<img
  src="https://img.shields.io/badge/Bitbucket-Coming%20Soon-lightgrey?logo=bitbucket"
  alt="Bitbucket – Coming Soon"/>
</p>

# GitBrancher

**CLI moderno para crear ramas Git con convenciones estandarizadas y análisis de impacto de Pull Requests**

GitBrancher es una herramienta CLI con branding moderno que estandariza la creación de ramas Git aplicando convenciones claras y consistentes. Facilita el trabajo colaborativo, la automatización de CI/CD y el análisis de impacto de cambios en repositorios.

## Instalación

```bash
npm i @livrasand/gitbrancher
```

## Inicio Rápido

```bash
# Crear una nueva rama con flujo interactivo
gitbrancher new

# Listar Pull Requests del repositorio
gitbrancher pr list

# Analizar impacto de un PR específico
gitbrancher pr analyze 144174

# Analizar PR con AI
gitbrancher pr analyze 144174 --ai

# Análisis completo + visualización HTML
gitbrancher pr analyze 144174 --ai --ai-full --html --open
```

## Comandos Disponibles

### Creación de Ramas
- **`gitbrancher new`** - Crea una nueva rama siguiendo convenciones estandarizadas
  - `-s, --silent` - Omite el banner de bienvenida
  - `-t, --type <type>` - Tipo de rama (feature, bugfix, etc.)
  - `-d, --desc <descriptor>` - Descripción de la rama o ID del ticket
  - `--push` - Sube la rama recién creada al repositorio remoto
  - `--no-interactive` - Ejecuta en modo no interactivo (requiere --type y --desc)

- **`gitbrancher list-types`** - Muestra los tipos de ramas disponibles

- **`gitbrancher info`** (alias: `status`) - Muestra información de la rama actual y valida si cumple la convención

### Gestión de Pull Requests
- **`gitbrancher pr list`** - Lista los Pull Requests del repositorio
  - `-s, --status <status>` - Estado de PRs (active, completed, all) - por defecto: active
  - `-n, --number <number>` - Número de PRs a mostrar - por defecto: 20

- **`gitbrancher pr analyze <prId>`** - Analiza un PR y genera grafo de impacto con análisis AI opcional
  - `-o, --output <file>` - Archivo de salida para el grafo JSON - por defecto: .gitbrancher/pr-<prId>.json
  - `--html` - Generar visualización HTML interactiva
  - `-m, --mermaid` - Generar diagrama en formato Mermaid (.mmd)
  - `--open` - Abrir automáticamente la visualización en el navegador (requiere --html)
  - `--ai` - Habilita análisis con AI
  - `--ai-full` - Análisis completo de cada archivo modificado (requiere --ai)

### Configuración
- **`gitbrancher config`** - Gestiona alias y credenciales
  - `-a, --alias <alias>` - Define un alias fijo para tus ramas
  - `--clear-alias` - Borra el alias almacenado previamente
  - `--azure` - Configura las credenciales de Azure DevOps mediante un asistente interactivo
  - `--clear-azure` - Elimina la configuración almacenada de Azure DevOps

- **`gitbrancher help`** - Muestra la ayuda completa

## Tipos de Ramas Soportados

| Tipo | Descripción | Prefijo sugerido |
|------|-------------|------------------|
| `feature` | Nuevas funcionalidades | feature/ |
| `bugfix` | Corrección de bugs | bugfix/ |
| `hotfix` | Corrección crítica en producción | hotfix/ |
| `chore` | Tareas de mantenimiento | chore/ |
| `docs` | Documentación | docs/ |
| `test` | Pruebas | test/ |
| `refactor` | Refactorización de código | refactor/ |

## Integración con Azure DevOps

GitBrancher se integra completamente con Azure DevOps para proporcionar una experiencia de desarrollo fluida.

### Configuración de Credenciales

```bash
gitbrancher config --azure
```

**¿Qué hace?**
- Configura organización, proyecto y Personal Access Token (PAT)
- Almacena credenciales de forma segura en el Keychain del sistema
- Soporta configuración por variables de entorno

### Flujo de Trabajo con Work Items

```bash
gitbrancher new
```

Cuando tienes credenciales configuradas:
1. Lista automáticamente tus work items asignados
2. Sugiere tipo de rama basado en el work item
3. Prellena el descriptor con ID y título
4. Crea la rama con formato `<usuario>/<tipo>/<descriptor>`

### Gestión de Pull Requests

```bash
# Listar PRs activos
gitbrancher pr list

# Analizar impacto de un PR específico
gitbrancher pr analyze 144174
```

**Características del análisis:**
- Lista archivos modificados
- Detecta dependencias entre archivos
- Identifica archivos afectados indirectamente
- Genera grafo JSON de impacto completo

## Seguridad y Almacenamiento

### Keychain Seguro (v1.1.0+)

A partir de la versión 1.1.0, GitBrancher utiliza el **Keychain del sistema operativo** para proteger tus credenciales:

- **macOS**: Keychain Access
- **Windows**: Credential Manager
- **Linux**: GNOME Keyring / libsecret

**Migración automática:** Si tenías credenciales anteriores, se migran automáticamente al sistema seguro.

### Protección de Credenciales

- **Antes**: PAT en texto plano en `~/.config/configstore/`
- **Ahora**: PAT encriptado por el sistema operativo
- Protección adicional con políticas del OS

## Análisis con AI

GitBrancher integra **AI** para análisis inteligente de código en Pull Requests, proporcionando insights sobre impacto, calidad y riesgos potenciales.

### Configuración de AI

```bash
# macOS/Linux - Agregar a ~/.zshrc o ~/.bashrc
export AI_API_KEY="tu_api_key_aqui"

# Recargar configuración
source ~/.zshrc
```

```powershell
# Windows (PowerShell)
[System.Environment]::SetEnvironmentVariable('AI_API_KEY', 'tu_api_key_aqui', 'User')
```

### Uso de AI

#### Análisis Básico

```bash
# Análisis con AI habilitado
gitbrancher pr analyze <prId> --ai

# Análisis completo de cada archivo
gitbrancher pr analyze <prId> --ai --ai-full

# Análisis + Visualización HTML
gitbrancher pr analyze <prId> --ai --html --open
```

### Qué Analiza la AI?

#### Análisis del PR Completo (`--ai`)
- **Alcance del Cambio**: ¿Es localizado o amplio?
- **Áreas de Impacto**: Componentes afectados
- **Riesgos Potenciales**: Efectos secundarios
- **Recomendaciones**: Qué revisar con atención

#### Análisis por Archivo (`--ai-full`)
- **Resumen**: ¿Qué cambió en cada archivo?
- **Impacto**: Efecto del cambio
- **Calidad**: ¿Es simple y claro?
- **Mejoras**: Sugerencias de optimización

#### Evaluación de Código
- ✅ **¿Es simple?** - Facilidad de comprensión
- ✅ **¿Es sencillo?** - Enfoque directo
- ✅ **¿Repite código?** - Duplicación
- ✅ **¿Hay mejor manera?** - Sugerencias

## Análisis de Impacto de PRs

GitBrancher puede analizar el impacto de un Pull Request generando un grafo completo de dependencias.

### Comando `pr analyze`

```bash
gitbrancher pr analyze <prId> [--output archivo.json]
```

### Grafo de Impacto Generado

```json
{
  "meta": {
    "tool": "gitbrancher",
    "version": "1.2.0",
    "type": "pr-impact",
    "base": "master",
    "head": "feature/branch-name",
    "prId": 144174,
    "prTitle": "hotfix: fail title...",
    "generatedAt": "2025-12-24T23:41:08.149Z",
    "stats": {
      "modifiedFiles": 2,
      "affectedFiles": 5,
      "totalFiles": 7,
      "dependencies": 6
    }
  },
  "nodes": [
    {
      "id": "/frontend/src/components/Component.html",
      "label": "Component.html",
      "kind": "file",
      "status": "edit",
      "modified": true,
      "url": "https://dev.azure.com/.../_apis/git/items/..."
    },
    {
      "id": "/frontend/src/pages/Page.html",
      "label": "Page.html",
      "kind": "file",
      "status": "affected",
      "modified": false
    }
  ],
  "edges": [
    {
      "from": "/frontend/src/pages/Page.html",
      "to": "/frontend/src/components/Component.html",
      "relation": "imports"
    }
  ]
}
```

### Tipos de Nodos
- **`modified: true`** - Archivos modificados directamente en el PR
- **`modified: false`** - Archivos afectados que importan los modificados

## Validaciones de Nombres de Rama

GitBrancher implementa validaciones robustas para garantizar nombres de rama consistentes y compatibles con Git.

### Reglas de Validación

1. **Caracteres especiales**: Solo letras, números, espacios y guiones
2. **Nombres reservados**: Evita `master`, `main`, `develop`, `head`, etc.
3. **Longitud**: Máximo 255 caracteres total, 50 por segmento
4. **Separadores**: Sin barras o guiones consecutivos
5. **Segmentos vacíos**: Todos los componentes deben tener contenido

### Ejemplos Válidos

```bash
# Resultado: user/feature/add-login
gitbrancher new

# Input: userAlias="john doe", branchType="feature", descriptor="add user login"
# Resultado: john-doe/feature/add-user-login
```

### Ejemplos Inválidos

```bash
# Caracteres especiales
user@domain/feature/test → Error: caracteres especiales no permitidos

# Nombre reservado
user/master/fix → Error: "master" está reservado

# Demasiado largo
user(feature/very-long-descriptor...) → Error: excede límites
```

## Configuración Avanzada

### Variables de Entorno

```bash
# Alias fijo
export GITBRANCHER_USER_ALIAS="mi-alias"

# Azure DevOps
export GITBRANCHER_AZURE_ORG="mi-organizacion"
export GITBRANCHER_AZURE_PROJECT="mi-proyecto"
export GITBRANCHER_AZURE_PAT="mi-token-seguro"
```

### Configuración Persistente

```bash
# Configurar alias
gitbrancher config --alias mi-alias

# Configurar Azure DevOps
gitbrancher config --azure

# Limpiar configuraciones
gitbrancher config --clear-alias
gitbrancher config --clear-azure
```

## Contribución

### Requisitos de Desarrollo

```bash
# Clonar y instalar
git clone https://github.com/livrasand/gitbrancher.git
cd gitbrancher
npm install

# Desarrollar
npm run build      # Compilar TypeScript/Svelte
npm run check      # Ejecutar linters y validaciones
npm run ci-test    # Ejecutar pruebas en contenedor

# Probar localmente
npm link
gitbrancher --help
```

---

**GitBrancher** - Estandarizando el desarrollo colaborativo, un commit a la vez.
