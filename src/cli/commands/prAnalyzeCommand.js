const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { fetchPullRequestDetails } = require('../../integrations/azureDevOpsService');
const { getEffectiveAzureConfig } = require('../../config/azureConfig');
const { analyzeDependencies } = require('../../utils/dependencyAnalyzer');
const aiAnalyzer = require('../../utils/aiAnalyzer');
const { isLoggedIn } = require('../../utils/auth');
const { getCredits, consumeCredits } = require('../../utils/auth');
const { createSpinner } = require('../display/spinner');
const pkg = require('../../../package.json');
const os = require('os');

/**
 * Obtiene el nombre del repositorio desde el remote origin de Git
 * @returns {Object} { organization, project, repository }
 * @throws {Error} Si no se puede determinar el repositorio
 */
function getRepositoryInfo() {
  try {
    const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();

    // Manejar URLs SSH y HTTPS
    let match;
    if (remoteUrl.includes('@ssh.dev.azure.com:')) {
      // SSH: git@ssh.dev.azure.com:v3/{organization}/{project}/{repository}
      match = remoteUrl.match(/git@ssh\.dev\.azure\.com:v3\/([^\/]+)\/([^\/]+)\/(.+)$/);
      if (match && match[3].endsWith('.git')) {
        match[3] = match[3].slice(0, -4);
      }
    } else if (remoteUrl.includes('dev.azure.com')) {
      // HTTPS: https://dev.azure.com/{organization}/{project}/_git/{repository}
      match = remoteUrl.match(/https:\/\/dev\.azure\.com\/([^\/]+)\/([^\/]+)\/_git\/(.+)$/);
      if (match && match[3].endsWith('.git')) {
        match[3] = match[3].slice(0, -4);
      }
    }

    if (!match) {
      throw new Error('El remote origin no parece ser un repositorio de Azure DevOps válido.');
    }

    return {
      organization: match[1],
      project: match[2],
      repository: match[3]
    };
  } catch (error) {
    throw new Error(`No se pudo determinar el repositorio desde Git: ${error.message}`);
  }
}

/**
 * Detecta la rama principal del repositorio
 * @param {string} repoRoot - Ruta raíz del repositorio
 * @returns {string} Nombre de la rama principal
 */
function detectMainBranch(repoRoot) {
  const candidates = ['main', 'master', 'develop', 'dev'];

  for (const branch of candidates) {
    try {
      // Verificar si existe origin/branch
      execSync(`git rev-parse --verify origin/${branch}`, {
        cwd: repoRoot,
        stdio: 'ignore'
      });
      return branch;
    } catch (e) {
      continue;
    }
  }

  // Si no se encuentra ninguna, intentar obtener la rama por defecto de origin
  try {
    const defaultBranch = execSync('git symbolic-ref refs/remotes/origin/HEAD', {
      cwd: repoRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim().replace('refs/remotes/origin/', '');

    if (defaultBranch) {
      return defaultBranch;
    }
  } catch (e) {
    // Continuar
  }

  // Fallback a master
  return 'master';
}

/**
 * Genera el contrato JSON del grafo de impacto del PR
 * @param {Object} prDetails - Detalles del PR con archivos modificados
 * @param {string} repoRoot - Ruta raíz del repositorio
 * @returns {Object} Contrato JSON del grafo
 */
function generateImpactGraph(prDetails, repoRoot) {
  // Hacer fetch de las ramas remotas para asegurar que tenemos la información actualizada
  try {
    execSync('git fetch origin --quiet', {
      cwd: repoRoot,
      stdio: 'ignore',
      timeout: 10000
    });
  } catch (e) {
    console.log(chalk.yellow('Advertencia: No se pudo actualizar referencias remotas'));
  }

  // Detectar la rama principal automáticamente
  const mainBranch = detectMainBranch(repoRoot);
  console.log(chalk.gray(`Usando rama base: ${mainBranch}`));

  // Nodos de archivos modificados con diff
  const modifiedNodes = prDetails.changedFiles.map(file => {
    let diff = null;

    // Obtener diff solo para archivos editados
    if (file.changeType.toLowerCase() === 'edit') {
      try {
        // Normalizar path (remover / inicial si existe)
        const normalizedPath = file.path.startsWith('/') ? file.path.substring(1) : file.path;

        // Estrategia más directa: obtener contenidos y compararlos
        let contentMain = null;
        let contentPR = null;

        // Obtener contenido del archivo en la rama principal
        try {
          contentMain = execSync(`git show origin/${mainBranch}:"${normalizedPath}"`, {
            cwd: repoRoot,
            encoding: 'utf-8',
            maxBuffer: 1024 * 1024 * 5,
            stdio: ['pipe', 'pipe', 'ignore'],
            timeout: 3000
          });
        } catch (e) {
          // Archivo no existe en main (puede ser nuevo)
        }

        // Obtener contenido del archivo en la rama del PR
        try {
          contentPR = execSync(`git show origin/${prDetails.sourceRefName}:"${normalizedPath}"`, {
            cwd: repoRoot,
            encoding: 'utf-8',
            maxBuffer: 1024 * 1024 * 5,
            stdio: ['pipe', 'pipe', 'ignore'],
            timeout: 3000
          });
        } catch (e) {
          // Archivo no existe en PR (puede estar eliminado)
        }

        // Si tenemos ambos contenidos, generar diff
        if (contentMain !== null && contentPR !== null) {
          // Crear archivos temporales para comparar
          const tmpDir = require('os').tmpdir();
          const tmpMain = path.join(tmpDir, `gitbrancher_main_${Date.now()}.tmp`);
          const tmpPR = path.join(tmpDir, `gitbrancher_pr_${Date.now()}.tmp`);

          try {
            fs.writeFileSync(tmpMain, contentMain);
            fs.writeFileSync(tmpPR, contentPR);

            // Generar diff usando git diff --no-index
            diff = execSync(`git diff --no-index "${tmpMain}" "${tmpPR}"`, {
              cwd: repoRoot,
              encoding: 'utf-8',
              maxBuffer: 1024 * 1024 * 5,
              stdio: ['pipe', 'pipe', 'ignore']
            }).trim();

            // Limpiar archivos temporales
            fs.unlinkSync(tmpMain);
            fs.unlinkSync(tmpPR);

            // Reemplazar nombres de archivos temporales por el path real en el diff
            if (diff) {
              diff = diff
                .replace(new RegExp(tmpMain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `a/${normalizedPath}`)
                .replace(new RegExp(tmpPR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `b/${normalizedPath}`);
            }
          } catch (e) {
            // Limpiar archivos temporales si existen
            try { fs.unlinkSync(tmpMain); } catch { }
            try { fs.unlinkSync(tmpPR); } catch { }
          }
        }

        // Si no se pudo obtener con el método anterior, intentar estrategias alternativas
        if (!diff) {
          const strategies = [
            `git diff origin/${mainBranch}...origin/${prDetails.sourceRefName} -- "${normalizedPath}"`,
            `git diff origin/${mainBranch}..origin/${prDetails.sourceRefName} -- "${normalizedPath}"`,
            `git diff origin/${prDetails.targetRefName}...origin/${prDetails.sourceRefName} -- "${normalizedPath}"`,
          ];

          for (const cmd of strategies) {
            try {
              const result = execSync(cmd, {
                cwd: repoRoot,
                encoding: 'utf-8',
                maxBuffer: 1024 * 1024 * 5,
                stdio: ['pipe', 'pipe', 'ignore'],
                timeout: 3000
              }).trim();

              if (result && result.length > 0) {
                diff = result;
                break;
              }
            } catch (e) {
              continue;
            }
          }
        }
      } catch (error) {
        // Si falla, continuar sin diff
      }
    }

    return {
      id: file.path,
      label: path.basename(file.path),
      kind: 'file',
      status: file.changeType.toLowerCase(),
      modified: true,
      url: file.url,
      diff: diff
    };
  });

  // Analizar dependencias entre archivos para generar edges
  const { edges, affectedFiles } = analyzeDependencies(prDetails.changedFiles, repoRoot, {
    includeReverseDeps: true,
    maxDepth: 2
  });

  // Nodos de archivos afectados (no modificados directamente)
  const affectedNodes = affectedFiles.map(filePath => ({
    id: filePath,
    label: path.basename(filePath),
    kind: 'file',
    status: 'affected',
    modified: false
  }));

  const allNodes = [...modifiedNodes, ...affectedNodes];

  return {
    meta: {
      tool: 'gitbrancher',
      version: pkg.version,
      type: 'pr-impact',
      base: prDetails.targetRefName,
      head: prDetails.sourceRefName,
      prId: prDetails.id,
      prTitle: prDetails.title,
      prUrl: prDetails.url,
      generatedAt: new Date().toISOString(),
      stats: {
        modifiedFiles: modifiedNodes.length,
        affectedFiles: affectedNodes.length,
        totalFiles: allNodes.length,
        dependencies: edges.length
      }
    },
    nodes: allNodes,
    edges: edges
  };
}

/**
 * Genera un visualizador HTML interactivo con Cytoscape.js
 * @param {Object} graph - Grafo de impacto
 * @param {string} htmlFile - Ruta del archivo HTML de salida
 */
function generateVisualization(graph, htmlFile) {
  const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PR #${graph.meta.prId} – Impacto</title>

  <!-- Fluent UI Web Components -->
  <script type="module">
    import {
      provideFluentDesignSystem,
      fluentButton,
      fluentCard,
      fluentBadge,
      fluentTabs,
      fluentTab,
      fluentTabPanel
    } from "https://unpkg.com/@fluentui/web-components@2.5.16";
    provideFluentDesignSystem().register(
      fluentButton(),
      fluentCard(),
      fluentBadge(),
      fluentTabs(),
      fluentTab(),
      fluentTabPanel()
    );
  </script>

  <!-- Cytoscape -->
  <script src="https://unpkg.com/cytoscape@3.28.1/dist/cytoscape.min.js"></script>

  <!-- Highlight.js -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/base16/github.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/diff.min.js"></script>

  <style>
    :root {
      --bg: #ffffff;
      --surface: #f6f8fa;
      --text-primary: #24292f;
      --text-secondary: #57606a;
      --text-muted: #8c949e;
      --brand: #0969da;
      --modified: #cf222e;
      --affected: #9a6700;
      --border: #d0d7de;
      --shadow: rgba(31, 35, 40, 0.08);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text-primary);
      height: 100vh;
      display: flex;
      overflow: hidden;
    }

    .graph-panel {
      flex: 1;
      position: relative;
      background: var(--bg);
    }

    #cy { width: 100%; height: 100%; }

    .legend {
      position: absolute;
      top: 20px;
      left: 20px;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 13px;
      color: var(--text-secondary);
      box-shadow: 0 4px 12px var(--shadow);
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .sidebar {
      width: 420px;
      background: var(--surface);
      border-left: 1px solid var(--border);
      display: flex;
      flex-direction: column;
    }

    .header {
      padding: 28px 24px 20px;
      border-bottom: 1px solid var(--border);
    }

    .pr-id {
      font-size: 13px;
      color: var(--brand);
      margin-bottom: 8px;
      font-weight: 500;
    }

    .pr-title {
      font-size: 20px;
      font-weight: 600;
      line-height: 1.3;
      margin-bottom: 16px;
    }

    .branches {
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 13px;
      color: var(--text-secondary);
    }

    .branch {
      padding: 4px 10px;
      border-radius: 6px;
      background: rgba(9, 105, 218, 0.1);
      color: var(--brand);
    }

    .stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      padding: 20px 24px;
    }

    .stat {
      text-align: center;
      padding: 16px;
      background: var(--bg);
      border-radius: 8px;
      border: 1px solid var(--border);
    }

    .stat-value {
      font-size: 28px;
      font-weight: 600;
      margin: 4px 0;
    }

    .stat-label {
      font-size: 12px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .controls {
      padding: 16px 24px;
      border-bottom: 1px solid var(--border);
    }

    fluent-tabs {
      margin-bottom: 16px;
    }

    .buttons {
      display: flex;
      gap: 8px;
    }

    fluent-button {
      flex: 1;
      font-size: 13px;
    }

    .details {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
    }

    .empty {
      text-align: center;
      padding: 80px 20px;
      color: var(--text-muted);
    }

    .empty-title {
      font-size: 18px;
      margin: 16px 0 8px;
      color: var(--text-secondary);
    }

    .file-card {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px var(--shadow);
    }

    .file-header {
      padding: 20px;
      border-bottom: 1px solid var(--border);
    }

    .file-title {
      font-size: 17px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .file-path {
      font-family: 'SF Mono', monospace;
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 8px;
    }

    .meta {
      display: flex;
      gap: 24px;
      margin-top: 16px;
      font-size: 14px;
    }

    .meta-item {
      display: flex;
      flex-direction: column;
    }

    .meta-label {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .meta-value {
      font-size: 20px;
      font-weight: 600;
      margin-top: 4px;
    }

    .impact-header {
      padding: 12px 20px;
      font-size: 14px;
      font-weight: 600;
      background: rgba(9, 105, 218, 0.05);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .impact-list {
      padding: 12px 20px;
    }

    .impact-item {
      padding: 10px 12px;
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.015);
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
      font-size: 13px;
    }

    .diff-header {
      padding: 12px 20px;
      background: rgba(9, 105, 218, 0.05);
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
    }

    .diff-content {
      background: #f6f8fa;
      max-height: 600px;
      overflow: auto;
    }

    .diff-content pre {
      margin: 0;
      padding: 20px;
      font-size: 12.5px;
      line-height: 1.6;
    }

    ::-webkit-scrollbar {
      width: 8px;
    }

    ::-webkit-scrollbar-track {
      background: transparent;
    }

    ::-webkit-scrollbar-thumb {
      background: #d0d7de;
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: #8c949e;
    }

    /* Estilos para análisis AI */
    .ai-analysis {
      background: linear-gradient(135deg, rgba(9, 105, 218, 0.05) 0%, rgba(9, 105, 218, 0.02) 100%);
      border: 1px solid rgba(9, 105, 218, 0.2);
    }

    .ai-header {
      padding: 16px 20px;
      background: rgba(9, 105, 218, 0.08);
      border-bottom: 1px solid rgba(9, 105, 218, 0.2);
      font-size: 15px;
      font-weight: 600;
      color: var(--brand);
      display: flex;
      align-items: center;
    }

    .ai-content {
      padding: 20px;
    }

    .ai-section {
      margin-bottom: 20px;
    }

    .ai-section:last-child {
      margin-bottom: 0;
    }

    .ai-section strong {
      display: block;
      margin-bottom: 8px;
      color: var(--text-primary);
      font-size: 14px;
    }

    .ai-text {
      padding: 12px 16px;
      background: var(--bg);
      border-left: 3px solid var(--brand);
      border-radius: 6px;
      font-size: 13px;
      line-height: 1.6;
      color: var(--text-secondary);
    }
  </style>
</head>
<body>
  <div class="graph-panel">
    <div id="cy"></div>
    <div class="legend">
      <div class="legend-item"><div class="legend-dot" style="background:#cf222e"></div> Modificados</div>
      <div class="legend-item"><div class="legend-dot" style="background:#9a6700"></div> Afectados</div>
      <div class="legend-item"><div class="legend-dot" style="background:#0969da"></div> Seleccionado</div>
    </div>
  </div>

  <div class="sidebar">
    <div class="header">
      <div class="pr-id">PR #${graph.meta.prId}</div>
      <div class="pr-title">${graph.meta.prTitle}</div>
      <div class="branches">
        <span class="branch">${graph.meta.head}</span>
        →
        <span class="branch">${graph.meta.base}</span>
      </div>
    </div>

    <div class="stats">
      <div class="stat">
        <div class="stat-value">${graph.meta.stats.modifiedFiles}</div>
        <div class="stat-label">Modificados</div>
      </div>
      <div class="stat">
        <div class="stat-value">${graph.meta.stats.affectedFiles}</div>
        <div class="stat-label">Afectados</div>
      </div>
      <div class="stat">
        <div class="stat-value">${graph.meta.stats.dependencies}</div>
        <div class="stat-label">Dependencias</div>
      </div>
      <div class="stat">
        <div class="stat-value">${graph.meta.stats.totalFiles}</div>
        <div class="stat-label">Total</div>
      </div>
    </div>

    <div class="controls">
      <div class="buttons">
        <fluent-button appearance="stealth" id="btn-reset">Reset</fluent-button>
        <fluent-button appearance="stealth" id="btn-fit">Ajustar</fluent-button>
        <fluent-button appearance="stealth" id="btn-layout">Layout</fluent-button>
      </div>
    </div>

    <div class="details" id="node-info">
      ${graph.meta.aiAnalysis && graph.meta.aiAnalysis.prSummary ?
      `<div class="file-card ai-analysis">
        <div class="ai-header">
          <svg style="width:20px;height:20px;margin-right:8px" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>
          Análisis AI del PR
        </div>
        <div class="ai-content">
          <div class="ai-text" style="white-space: pre-wrap;">${graph.meta.aiAnalysis.prSummary.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</div>
        </div>
      </div>`
      : ''}
      <div class="empty">
        <div style="font-size:64px; opacity:0.3; margin-bottom:16px;">🎯</div>
        <div class="empty-title">Selecciona un nodo</div>
        <p>Haz clic en cualquier archivo del grafo para ver sus detalles e impacto.</p>
      </div>
    </div>
  </div>

  <script id="graph-data-b64" type="text/plain">${Buffer.from(JSON.stringify(graph)).toString('base64')}</script>

  <script>
    // Decodificar datos desde Base64 para evitar errores de sintaxis por caracteres especiales
    const b64Data = document.getElementById('graph-data-b64').textContent;
    const graphData = JSON.parse(atob(b64Data));

    const elements = [
      ...graphData.nodes.map(n => ({ data: { id: n.id, label: n.label, modified: n.modified, status: n.status, diff: n.diff } })),
      ...graphData.edges.map(e => ({ data: { source: e.from, target: e.to, line: e.line } }))
    ];

    const cy = cytoscape({
      container: document.getElementById('cy'),
      elements,
      style: [
        { selector: 'node', style: { 'background-color': '#e1e4e8', 'label': 'data(label)', 'color': '#24292f', 'text-valign': 'center', 'font-size': 12, 'width': 44, 'height': 44 } },
        { selector: 'node[modified="true"]', style: { 'background-color': '#cf222e' } },
        { selector: 'node[modified="false"]', style: { 'background-color': '#9a6700' } },
        { selector: 'edge', style: { 'width': 1.5, 'line-color': '#d0d7de', 'target-arrow-color': '#d0d7de', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier' } },
        { selector: 'node:selected, .highlighted', style: { 'background-color': '#0969da', 'border-width': 3, 'border-color': '#1f6feb' } },
        { selector: '.highlighted', style: { 'line-color': '#0969da', 'target-arrow-color': '#0969da' } },
        { selector: '.dimmed', style: { opacity: 0.3 } }
      ],
      layout: { name: 'cose', animate: true, idealEdgeLength: 100, nodeRepulsion: 8000 }
    });

    let currentFilter = 'all';
    let currentLayoutIndex = 0;

    document.querySelectorAll('fluent-tab').forEach((tab, i) => {
      tab.addEventListener('click', () => {
        const filters = ['all', 'modified', 'affected'];
        currentFilter = filters[i];
        applyFilter();
      });
    });

    document.getElementById('btn-reset').onclick = () => { cy.fit(); cy.center(); cy.elements().removeClass('highlighted dimmed'); applyFilter(); };
    document.getElementById('btn-fit').onclick = () => cy.fit();
    document.getElementById('btn-layout').onclick = () => {
      const layouts = [
        { name: 'cose', animate: true, idealEdgeLength: 100, nodeRepulsion: 8000 },
        { name: 'circle', animate: true },
        { name: 'grid', animate: true },
        { name: 'concentric', animate: true }
      ];
      currentLayoutIndex = (currentLayoutIndex + 1) % layouts.length;
      cy.layout(layouts[currentLayoutIndex]).run();
    };

    function applyFilter() {
      cy.elements().removeClass('dimmed');
      if (currentFilter === 'modified') cy.nodes('[modified="false"]').addClass('dimmed');
      if (currentFilter === 'affected') cy.nodes('[modified="true"]').addClass('dimmed');
    }

    cy.on('tap', 'node', function(e) {
      const node = e.target;
      const data = node.data();
      
      cy.elements().removeClass('highlighted dimmed');
      node.addClass('highlighted');
      node.connectedEdges().addClass('highlighted');
      node.neighborhood('node').addClass('highlighted');
      applyFilter();

      const nodeInfo = document.getElementById('node-info');
      
      let html = '<div class="file-card">' +
          '<div class="file-header">' +
            '<div class="file-title">' +
              data.label + ' ' + 
              (data.modified 
                ? '<fluent-badge appearance="filled" color="danger">Modificado</fluent-badge>' 
                : '<fluent-badge appearance="filled" color="warning">Afectado</fluent-badge>') +
            '</div>' +
            '<div class="file-path">' + data.id + '</div>' +
            '<div class="meta">' +
              '<div class="meta-item"><div class="meta-label">Entrantes</div><div class="meta-value">' + node.incomers('node').length + '</div></div>' +
              '<div class="meta-item"><div class="meta-label">Salientes</div><div class="meta-value">' + node.outgoers('node').length + '</div></div>' +
            '</div>' +
          '</div>' +
        '</div>';

      if (data.modified) {
        const incoming = node.incomers('edge').map(function(e) { return { from: e.source().data('label'), line: e.data('line') }; });
        if (incoming.length > 0) {
          html += '<div class="file-card">' +
              '<div class="impact-header">Archivos que serán afectados</div>' +
              '<div class="impact-list">' +
                incoming.map(function(i) {
                  return '<div class="impact-item">' +
                    '<span>' + i.from + '</span>' +
                    '<span>' + (i.line ? 'línea ' + i.line : '') + '</span>' +
                  '</div>';
                }).join('') +
              '</div>' +
            '</div>';
        }
      }

      const outgoingNodes = node.outgoers('edge');
      if (outgoingNodes.length > 0) {
        const outgoing = outgoingNodes.map(function(e) { return { to: e.target().data('label'), line: e.data('line') }; });
        html += '<div class="file-card">' +
            '<div class="impact-header">Archivos que lo afectan</div>' +
            '<div class="impact-list">' +
              outgoing.map(function(o) {
                return '<div class="impact-item">' +
                  '<span>' + o.to + '</span>' +
                  '<span>' + (o.line ? 'línea ' + o.line : '') + '</span>' +
                '</div>';
              }).join('') +
            '</div>' +
          '</div>';
      }

      if (data.diff) {
        html += '<div class="file-card">' +
            '<div class="diff-header">' +
              '<span>Cambios</span>' +
              '<fluent-button appearance="stealth" size="small" onclick="navigator.clipboard.writeText(this.parentElement.nextElementSibling.textContent)">Copiar</fluent-button>' +
            '</div>' +
            '<div class="diff-content">' +
              '<pre><code class="language-diff">' + data.diff.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</code></pre>' +
            '</div>' +
          '</div>';
      }

      // Mostrar análisis AI si está disponible
      if (graphData.meta.aiAnalysis && graphData.meta.aiAnalysis.fileAnalyses && graphData.meta.aiAnalysis.fileAnalyses[data.id]) {
        const aiData = graphData.meta.aiAnalysis.fileAnalyses[data.id];
        const escapeHtml = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\\n/g, '<br>');
        const aiChanges = escapeHtml(aiData.changes);
        const aiQuality = escapeHtml(aiData.quality);
        const aiImprovements = escapeHtml(aiData.improvements);
        html += '<div class="file-card ai-analysis">' +
          '<div class="ai-header">' +
            '<svg style="width:20px;height:20px;margin-right:8px" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>' +
            'Análisis AI' +
          '</div>' +
          '<div class="ai-content">' +
            '<div class="ai-section"><strong>[NOTE] Resumen:</strong><div class="ai-text">' + aiChanges + '</div></div>' +
            '<div class="ai-section"><strong>[SUCCESS] Calidad:</strong><div class="ai-text">' + aiQuality + '</div></div>' +
            '<div class="ai-section"><strong>[TIP] Mejoras:</strong><div class="ai-text">' + aiImprovements + '</div></div>' +
          '</div>' +
        '</div>';
      }

      document.getElementById('node-info').innerHTML = html;
      hljs.highlightAll();
    });

    cy.on('tap', e => { 
      if (e.target === cy) { 
        document.getElementById('node-info').innerHTML = '<div class="empty"><div style="font-size:64px; opacity:0.3; margin-bottom:16px;">🎯</div><div class="empty-title">Selecciona un nodo</div><p>Haz clic en cualquier archivo del grafo para ver sus detalles e impacto.</p></div>'; 
        cy.elements().removeClass('highlighted'); 
        applyFilter(); 
      }
    });

    applyFilter();
    cy.fit();

    // Función para copiar diff usando el botón
    function copyDiffById(button) {
      const nodeId = button.getAttribute('data-node-id');
      const node = graphData.nodes.find(n => n.id === nodeId);
      if (node && node.diff) {
        navigator.clipboard.writeText(node.diff).then(() => {
          alert('¡Diff copiado al portapapeles!');
        }).catch(err => {
          console.error('Error al copiar:', err);
        });
      }
    }
  </script>
</body>
</html>`;

  const fs = require('fs');
  fs.writeFileSync(htmlFile, htmlContent);
}

/**
 * Exporta el grafo a formato Mermaid
 * @param {Object} graph - Grafo de impacto
 * @returns {string} Diagrama en formato Mermaid
 */
function exportToMermaid(graph) {
  let mermaid = 'graph TD\n';

  graph.nodes.forEach(node => {
    const style = node.modified ? ':::modified' : ':::affected';
    const id = node.id.replace(/[^a-zA-Z0-9]/g, '_');
    const label = node.label.replace(/"/g, "'");
    mermaid += '  ' + id + '["' + label + '"]' + style + '\n';
  });

  mermaid += '\n';

  graph.edges.forEach(edge => {
    const fromId = edge.from.replace(/[^a-zA-Z0-9]/g, '_');
    const toId = edge.to.replace(/[^a-zA-Z0-9]/g, '_');
    mermaid += '  ' + fromId + ' --> ' + toId + '\n';
  });

  mermaid += '\n';
  mermaid += 'classDef modified fill:#f85149,stroke:#da3633,color:#fff\n';
  mermaid += 'classDef affected fill:#d29922,stroke:#bb8009,color:#fff\n';

  return mermaid;
}

/**
 * Analiza un Pull Request específico y genera el grafo de impacto
 * @param {Object} options - Opciones del comando
 * @param {string} options.prId - ID del Pull Request a analizar
 * @param {string} options.output - Archivo de salida (por defecto: graph.json)
 */
async function analyzePullRequest(options) {
  try {
    const azureConfig = await getEffectiveAzureConfig();

    if (!azureConfig.pat) {
      console.error(chalk.red('\nError: Token personal (PAT) de Azure DevOps no configurado.'));
      console.log(chalk.yellow('Ejecuta "gitbrancher config --azure" para configurarlo.\n'));
      process.exit(1);
    }

    const repoInfo = getRepositoryInfo();

    const fetchSpinner = createSpinner(`Obteniendo detalles del PR #${options.prId}...`);

    let prDetails;
    try {
      prDetails = await fetchPullRequestDetails({
        organization: repoInfo.organization,
        project: repoInfo.project,
        repository: repoInfo.repository,
        pat: azureConfig.pat,
        pullRequestId: options.prId
      });
      fetchSpinner.succeed(`PR obtenido: ${prDetails.title}`);
    } catch (error) {
      fetchSpinner.fail(`No se pudo obtener el PR: ${error.message}`);
      throw error;
    }

    console.log(chalk.blue(`PR: ${prDetails.title}`));
    console.log(chalk.gray(`Estado: ${prDetails.status} | Creado por: ${prDetails.createdBy}`));
    console.log(chalk.gray(`Rama: ${prDetails.sourceRefName} → ${prDetails.targetRefName}`));

    // Obtener la ruta raíz del repositorio
    const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();

    // Generar grafo de impacto
    const graphSpinner = createSpinner('Generando grafo de impacto y analizando dependencias...');
    const impactGraph = generateImpactGraph(prDetails, repoRoot);
    graphSpinner.succeed('Grafo de impacto generado correctamente.');

    // Crear directorio .gitbrancher si no existe
    const gitbrancherDir = path.join(repoRoot, '.gitbrancher');
    if (!fs.existsSync(gitbrancherDir)) {
      fs.mkdirSync(gitbrancherDir, { recursive: true });
    }

    // Guardar el archivo JSON con el ID del PR
    const outputFile = options.output || path.join(gitbrancherDir, `pr-${options.prId}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(impactGraph, null, 2));

    console.log(chalk.green(`\n✓ Grafo de conocimiento generado en: ${outputFile}`));
    console.log(chalk.gray(`Archivos modificados: ${impactGraph.meta.stats.modifiedFiles} | Archivos afectados: ${impactGraph.meta.stats.affectedFiles} | Dependencias: ${impactGraph.meta.stats.dependencies}`));

    // Análisis con AI si se solicita
    if (options.ai) {
      if (!(await isLoggedIn())) {
        console.error(chalk.red('\nError: Debes iniciar sesión para usar AI.'));
        console.log(chalk.yellow('Ejecuta "gitbrancher login" para autenticarte.\n'));
        process.exit(1);
      }

      const credits = await getCredits();
      if (!credits) {
        console.error(chalk.red('\nError: No se pudieron obtener créditos.'));
        process.exit(1);
      }

      const amount = options.aiFull ? 3 : 1;
      if (credits.credits_used + amount > credits.credits_limit) {
        console.error(chalk.red(`\n[ERROR] Créditos insuficientes (${credits.credits_used}/${credits.credits_limit}).`));
        if (credits.plan === 'free') {
          console.log(chalk.yellow('Actualiza a Pro para 500 créditos AI / mes.'));
        }
        process.exit(1);
      }

      console.log(chalk.blue(`[AI] Créditos antes: ${credits.credits_used}/${credits.credits_limit}`));

      let aiSpinner = createSpinner('[BOT] Analizando impacto con AI...');
      try {
        const analyzer = new aiAnalyzer();

        // Análisis general del PR
        const prAnalysis = await analyzer.analyzePRImpact(
          prDetails.title,
          impactGraph.nodes.filter(n => n.modified),
          impactGraph.nodes.filter(n => !n.modified).map(n => n.id),
          impactGraph.edges
        );

        impactGraph.meta.aiAnalysis = {
          prSummary: prAnalysis,
          fileAnalyses: {},
          timestamp: new Date().toISOString()
        };

        // Análisis por archivo (solo archivos modificados con diff)
        if (options.aiFull) {
          aiSpinner.text = '[BOT] Analizando archivos modificados con AI...';
          for (const node of impactGraph.nodes.filter(n => n.modified && n.diff)) {
            try {
              const [changes, quality, improvements] = await Promise.all([
                analyzer.analyzeFileChanges(node.id, node.diff),
                analyzer.evaluateCodeQuality(node.id, node.diff),
                analyzer.suggestImprovements(node.id, node.diff)
              ]);

              impactGraph.meta.aiAnalysis.fileAnalyses[node.id] = {
                changes,
                quality,
                improvements
              };
            } catch (error) {
              console.log(chalk.yellow(`  [WARNING] ${node.label}: ${error.message}`));
            }
          }
        }

        // Guardar el grafo actualizado con análisis AI
        fs.writeFileSync(outputFile, JSON.stringify(impactGraph, null, 2));
        aiSpinner.succeed('Análisis AI completado.');

        // Consumir créditos
        const consumeResult = await consumeCredits(amount);
        if (consumeResult.success) {
          console.log(chalk.blue(`[AI] Créditos después: ${consumeResult.credits_used}/${consumeResult.credits_limit}`));
        } else {
          console.log(chalk.yellow('[WARNING] No se pudieron consumir créditos, pero análisis completado.'));
          if (consumeResult.reason === 'not_logged_in') {
            console.log(chalk.gray('Razón: No hay sesión activa'));
          } else if (consumeResult.reason === 'insufficient_credits') {
            console.log(chalk.gray('Razón: Créditos insuficientes'));
          } else if (consumeResult.details) {
            console.log(chalk.gray(`Razón: Error del servidor (${consumeResult.details.status || 'desconocido'})`));
            if (process.env.DEBUG) {
              console.log(chalk.gray(`Detalles: ${consumeResult.details.message}`));
            }
          }
          console.log(chalk.gray('Tip: Ejecuta con DEBUG=1 para ver más detalles'));
        }

        // Mostrar resumen del análisis
        if (!options.html) {
          console.log(chalk.cyan('\n[ANALYTICS] Análisis de Impacto del PR:\n'));
          console.log(prAnalysis);
        }
      } catch (error) {
        aiSpinner.fail(`No se pudo completar el análisis AI: ${error.message}`);
        console.log(chalk.gray('Verifica tu conexión a internet o intenta más tarde'));
      }
    }

    // Generar visualización HTML si se solicita
    if (options.html) {
      const htmlFile = options.output
        ? outputFile.replace('.json', '.html')
        : path.join(gitbrancherDir, `pr-${options.prId}.html`);
      generateVisualization(impactGraph, htmlFile);
      console.log(chalk.green(`\n✓ Visualización HTML generada en: ${htmlFile}`));
      console.log(chalk.gray('Abre el archivo en tu navegador para explorar el grafo de conocimiento'));

      // Abrir automáticamente en el navegador si se solicita
      if (options.open) {
        const openCommand = process.platform === 'darwin' ? 'open' :
          process.platform === 'win32' ? 'start' : 'xdg-open';
        try {
          execSync(`${openCommand} ${htmlFile}`, { stdio: 'ignore' });
          console.log(chalk.green('✓ Visualización abierta en el navegador'));
        } catch (error) {
          console.log(chalk.yellow(`No se pudo abrir automáticamente. Abre manualmente: ${htmlFile}`));
        }
      }
    }

    // Generar diagrama Mermaid si se solicita
    if (options.mermaid) {
      const mermaidFile = options.output
        ? outputFile.replace('.json', '.mmd')
        : path.join(gitbrancherDir, `pr-${options.prId}.mmd`);
      const mermaidContent = exportToMermaid(impactGraph);
      fs.writeFileSync(mermaidFile, mermaidContent);
      console.log(chalk.green(`\n✓ Diagrama Mermaid generado en: ${mermaidFile}`));
      console.log(chalk.gray('Puedes usar este archivo en GitHub, GitLab o cualquier visor de Mermaid'));
    }

    // Mostrar resumen de archivos modificados
    const modifiedNodes = impactGraph.nodes.filter(n => n.modified);
    if (modifiedNodes.length > 0) {
      console.log(chalk.cyan('\n[NOTE] Archivos modificados en el PR:'));
      modifiedNodes.forEach((node) => {
        const changeTypeIcon = node.status === 'add' ? chalk.green('[+]') :
          node.status === 'edit' ? chalk.blue('[EDIT]') :
            node.status === 'delete' ? chalk.red('[DELETE]') : chalk.gray('[UNKNOWN]');
        console.log(`  ${changeTypeIcon} ${node.id}`);
      });
    }

    // Mostrar archivos afectados
    const affectedNodes = impactGraph.nodes.filter(n => !n.modified);
    if (affectedNodes.length > 0) {
      console.log(chalk.yellow(`\n[WARNING]  Archivos afectados (importan los modificados):`));
      affectedNodes.slice(0, 10).forEach((node) => {
        console.log(`  ${chalk.yellow('[AFFECTED]')} ${node.id}`);
      });
      if (affectedNodes.length > 10) {
        console.log(chalk.gray(`  ... y ${affectedNodes.length - 10} archivos más`));
      }
    }

  } catch (error) {
    console.error(chalk.red('\nError:'), error.message);

    if (error.message.includes('no parece ser un repositorio de Azure DevOps')) {
      console.log(chalk.yellow('\nEste comando solo funciona con repositorios de Azure DevOps.'));
      console.log(chalk.gray('El repositorio actual parece ser de otro proveedor (GitHub, GitLab, etc.).\n'));
    }

    process.exit(1);
  }
}

module.exports = { analyzePullRequest };
