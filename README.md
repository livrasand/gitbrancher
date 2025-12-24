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

# GitBrancher

**CLI moderno para crear ramas Git con convenciones estandarizadas y análisis de impacto de Pull Requests**

GitBrancher es una herramienta CLI con branding moderno que estandariza la creación de ramas Git aplicando convenciones claras y consistentes. Facilita el trabajo colaborativo, la automatización de CI/CD y el análisis de impacto de cambios en repositorios.

## Características Principales

- **Creación estandarizada de ramas** con formato `<usuario>/<tipo>/<descriptor>`
- **Integración con Azure DevOps** para consultar work items y Pull Requests
- **Análisis de impacto** de PRs con grafo de dependencias
- **Almacenamiento seguro** de credenciales con Keychain del sistema
- **Interfaz visual atractiva** con colores y banners
- **Validaciones robustas** de nombres de rama
- **Compatibilidad multiplataforma** (macOS, Windows, Linux)

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
```

## Comandos Disponibles

### Creación de Ramas
- **`gitbrancher new`** - Crea una nueva rama siguiendo convenciones estandarizadas
- **`gitbrancher list-types`** - Muestra los tipos de ramas disponibles

### Gestión de Pull Requests
- **`gitbrancher pr list`** - Lista los Pull Requests del repositorio
- **`gitbrancher pr analyze <prId>`** - Analiza un PR y genera grafo de impacto

### Configuración
- **`gitbrancher config`** - Gestiona alias y credenciales
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
    "prTitle": "PBI 399577: Studio Text...",
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
      "id": "/frontend/src/components/Component.svelte",
      "label": "Component.svelte",
      "kind": "file",
      "status": "edit",
      "modified": true,
      "url": "https://dev.azure.com/.../_apis/git/items/..."
    },
    {
      "id": "/frontend/src/pages/Page.svelte",
      "label": "Page.svelte",
      "kind": "file",
      "status": "affected",
      "modified": false
    }
  ],
  "edges": [
    {
      "from": "/frontend/src/pages/Page.svelte",
      "to": "/frontend/src/components/Component.svelte",
      "relation": "imports"
    }
  ]
}
```

### Tipos de Nodos
- **`modified: true`** - Archivos modificados directamente en el PR
- **`modified: false`** - Archivos afectados que importan los modificados

## Arquitectura Técnica

### Componentes Principales

```
┌─────────────────┐
│   CLI Entry     │ bin/gitbrancher.js
│   (Commander)   │
└─────────┬───────┘
          │
    ┌─────┴─────┐
    │ Commands │ src/cli/commands/
    │          │ ├── newCommand.js
    │          │ ├── prListCommand.js
    │          │ ├── prAnalyzeCommand.js
    │          │ └── ...
    └─────┬─────┘
          │
    ┌─────┴─────────────────────┐
    │ Services & Utils         │
    │                          │
    │ • Azure DevOps Service   │ src/integrations/
    │ • Git Service            │ src/git/
    │ • Config Management      │ src/config/
    │ • Dependency Analyzer    │ src/utils/
    │ • Validation Utils       │ src/cli/utils/
    └──────────────────────────┘
```

### Tecnologías Utilizadas

- **Commander.js** - CLI framework
- **Axios** - HTTP client para Azure DevOps API
- **Simple-git** - Git operations
- **Keytar** - Secure credential storage
- **Inquirer.js** - Interactive prompts
- **Chalk & Figlet** - Terminal styling
- **Boxen** - Terminal boxes

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

## Mejores Prácticas

### Convenciones de Rama

1. **Usa tipos estándar**: `feature`, `bugfix`, `hotfix`, `chore`, `docs`
2. **Nombres descriptivos**: Explica claramente el propósito
3. **IDs de tickets**: Incluye números de work item cuando aplique
4. **Nombres cortos**: Mantén legibilidad (máximo 50 chars por segmento)

### Trabajo con PRs

1. **Analiza antes de merge**: Usa `gitbrancher pr analyze` para entender impacto
2. **Revisa dependencias**: Verifica archivos afectados indirectamente
3. **Configura credenciales**: Asegura acceso a Azure DevOps API

### Seguridad

1. **PAT con permisos mínimos**: Solo Code (read/write) y Work Items (read)
2. **Expiración de tokens**: Renueva tokens periódicamente
3. **Acceso controlado**: Limita visibilidad de credenciales

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

### Estructura de Código

- **`bin/`** - Punto de entrada CLI
- **`src/cli/commands/`** - Implementación de comandos
- **`src/integrations/`** - Servicios externos (Azure DevOps)
- **`src/git/`** - Operaciones Git
- **`src/config/`** - Gestión de configuración
- **`src/utils/`** - Utilidades compartidas
- **`tests/`** - Suite de pruebas

---

**GitBrancher** - Estandarizando el desarrollo colaborativo, un commit a la vez.
