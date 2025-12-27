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

**Modern CLI for creating Git branches with standardized conventions and Pull Request impact analysis**

GitBrancher is a modern CLI tool with branding that standardizes Git branch creation by applying clear and consistent conventions. It facilitates collaborative work, CI/CD automation, and impact analysis of changes in repositories.

## Installation

```bash
npm i @livrasand/gitbrancher
```

## Quick Start

```bash
# Create a new branch with interactive flow
gitbrancher new

# List Pull Requests from the repository
gitbrancher pr list

# Analyze impact of a specific PR
gitbrancher pr analyze 144174

# Analyze PR with AI
gitbrancher pr analyze 144174 --ai

# Full analysis + HTML visualization
gitbrancher pr analyze 144174 --ai --ai-full --html --open
```

## Available Commands

### Branch Creation
- **`gitbrancher new`** - Creates a new branch following standardized conventions
  - `-s, --silent` - Omits the welcome banner
  - `-t, --type <type>` - Branch type (feature, bugfix, etc.)
  - `-d, --desc <descriptor>` - Branch description or ticket ID
  - `--push` - Pushes the newly created branch to the remote repository
  - `--no-interactive` - Runs in non-interactive mode (requires --type and --desc)

- **`gitbrancher list-types`** - Shows available branch types

- **`gitbrancher info`** (alias: `status`) - Shows information about the current branch and validates if it complies with the convention

### Pull Request Management
- **`gitbrancher pr list`** - Lists the Pull Requests of the repository
  - `-s, --status <status>` - PR status (active, completed, all) - default: active
  - `-n, --number <number>` - Number of PRs to show - default: 20

- **`gitbrancher pr analyze <prId>`** - Analyzes a PR and generates impact graph with optional AI analysis
  - `-o, --output <file>` - Output file for the JSON graph - default: .gitbrancher/pr-<prId>.json
  - `--html` - Generate interactive HTML visualization
  - `-m, --mermaid` - Generate diagram in Mermaid format (.mmd)
  - `--open` - Automatically open the visualization in the browser (requires --html)
  - `--ai` - Enables AI analysis
  - `--ai-full` - Full analysis of each modified file (requires --ai)

### Configuration
- **`gitbrancher config`** - Manages aliases and credentials
  - `-a, --alias <alias>` - Defines a fixed alias for your branches
  - `--clear-alias` - Deletes the previously stored alias
  - `--azure` - Configures Azure DevOps credentials through an interactive assistant
  - `--clear-azure` - Removes the stored Azure DevOps configuration

- **`gitbrancher help`** - Shows complete help

## Supported Branch Types

| Type | Description | Suggested Prefix |
|------|-------------|------------------|
| `feature` | New features | feature/ |
| `bugfix` | Bug fixes | bugfix/ |
| `hotfix` | Critical fixes in production | hotfix/ |
| `chore` | Maintenance tasks | chore/ |
| `docs` | Documentation | docs/ |
| `test` | Tests | test/ |
| `refactor` | Code refactoring | refactor/ |

## Azure DevOps Integration

GitBrancher fully integrates with Azure DevOps to provide a seamless development experience.

### Credential Configuration

```bash
gitbrancher config --azure
```

**What does it do?**
- Configures organization, project, and Personal Access Token (PAT)
- Stores credentials securely in the system Keychain
- Supports configuration via environment variables

### Workflow with Work Items

```bash
gitbrancher new
```

When you have credentials configured:
1. Automatically lists your assigned work items
2. Suggests branch type based on the work item
3. Fills the descriptor with ID and title
4. Creates the branch with format `<user>/<type>/<descriptor>`

### Pull Request Management

```bash
# List active PRs
gitbrancher pr list

# Analyze impact of a specific PR
gitbrancher pr analyze 144174
```

**Analysis features:**
- Lists modified files
- Detects dependencies between files
- Identifies indirectly affected files
- Generates complete impact JSON graph

## Security and Storage

### Secure Keychain (v1.1.0+)

Starting from version 1.1.0, GitBrancher uses the **operating system Keychain** to protect your credentials:

- **macOS**: Keychain Access
- **Windows**: Credential Manager
- **Linux**: GNOME Keyring / libsecret

**Automatic migration:** If you had previous credentials, they are automatically migrated to the secure system.

### Credential Protection

- **Before**: PAT in plain text in `~/.config/configstore/`
- **Now**: PAT encrypted by the operating system
- Additional protection with OS policies

## Authentication

GitBrancher requires authentication to access advanced features like AI analysis.

### Registration

```bash
gitbrancher register
```

### Login

```bash
gitbrancher login
```

### Logout

```bash
gitbrancher logout
```

## AI Analysis

GitBrancher integrates **AI** for intelligent code analysis in Pull Requests, providing insights on impact, quality, and potential risks.

Requires prior authentication with gitbrancher login.

### AI Usage

#### Basic Analysis

```bash
# Analysis with AI enabled
gitbrancher pr analyze <prId> --ai

# Full analysis of each file
gitbrancher pr analyze <prId> --ai --ai-full

# Analysis + HTML Visualization
gitbrancher pr analyze <prId> --ai --html --open
```

### What does the AI analyze?

#### Complete PR Analysis (`--ai`)
- **Change Scope**: Is it localized or broad?
- **Impact Areas**: Affected components
- **Potential Risks**: Side effects
- **Recommendations**: What to review carefully

#### Per-File Analysis (`--ai-full`)
- **Summary**: What changed in each file?
- **Impact**: Effect of the change
- **Quality**: Is it simple and clear?
- **Improvements**: Optimization suggestions

#### Code Evaluation
- ✅ **Is it simple?** - Ease of understanding
- ✅ **Is it straightforward?** - Direct approach
- ✅ **Does it repeat code?** - Duplication
- ✅ **Is there a better way?** - Suggestions

## Pull Request Impact Analysis

GitBrancher can analyze the impact of a Pull Request by generating a complete dependency graph.

### `pr analyze` Command

```bash
gitbrancher pr analyze <prId> [--output file.json]
```

### Generated Impact Graph

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

### Node Types
- **`modified: true`** - Files directly modified in the PR
- **`modified: false`** - Affected files that import the modified ones

## Branch Name Validations

GitBrancher implements robust validations to ensure consistent and Git-compatible branch names.

### Validation Rules

1. **Special characters**: Only letters, numbers, spaces, and hyphens
2. **Reserved names**: Avoid `master`, `main`, `develop`, `head`, etc.
3. **Length**: Maximum 255 characters total, 50 per segment
4. **Separators**: No consecutive slashes or hyphens
5. **Empty segments**: All components must have content

### Valid Examples

```bash
# Result: user/feature/add-login
gitbrancher new

# Input: userAlias="john doe", branchType="feature", descriptor="add user login"
# Result: john-doe/feature/add-user-login
```

### Invalid Examples

```bash
# Special characters
user@domain/feature/test → Error: special characters not allowed

# Reserved name
user/master/fix → Error: "master" is reserved

# Too long
user(feature/very-long-descriptor...) → Error: exceeds limits
```

## Advanced Configuration

### Environment Variables

```bash
# Fixed alias
export GITBRANCHER_USER_ALIAS="my-alias"

# Azure DevOps
export GITBRANCHER_AZURE_ORG="my-organization"
export GITBRANCHER_AZURE_PROJECT="my-project"
export GITBRANCHER_AZURE_PAT="my-secure-token"
```

### Persistent Configuration

```bash
# Configure alias
gitbrancher config --alias my-alias

# Configure Azure DevOps
gitbrancher config --azure

# Clear configurations
gitbrancher config --clear-alias
gitbrancher config --clear-azure
```

## Contribution

### Development Requirements

```bash
# Clone and install
git clone https://github.com/livrasand/gitbrancher.git
cd gitbrancher
npm install

# Develop
npm run build      # Compile TypeScript/Svelte
npm run check      # Run linters and validations
npm run ci-test    # Run tests in container

# Test locally
npm link
gitbrancher --help
```

---

**GitBrancher** - Standardizing collaborative development, one commit at a time.
