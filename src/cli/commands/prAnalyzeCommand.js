const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { fetchPullRequestDetails } = require('../../integrations/azureDevOpsService');
const { getEffectiveAzureConfig } = require('../../config/azureConfig');
const { analyzeDependencies } = require('../../utils/dependencyAnalyzer');
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
            try { fs.unlinkSync(tmpMain); } catch {}
            try { fs.unlinkSync(tmpPR); } catch {}
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
  <title>PR Impact Graph - ${graph.meta.prId}</title>
  <script src="https://unpkg.com/cytoscape@3.28.1/dist/cytoscape.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/diff.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #0f1419;
      color: #e6edf3;
      overflow: hidden;
    }
    
    .container {
      display: flex;
      height: 100vh;
    }
    
    /* Panel Principal - Grafo */
    #cy {
      flex: 1;
      background: #0f1419;
      position: relative;
    }
    
    .graph-overlay {
      position: absolute;
      top: 20px;
      left: 20px;
      background: rgba(1, 4, 9, 0.8);
      backdrop-filter: blur(10px);
      border: 1px solid #30363d;
      border-radius: 12px;
      padding: 16px;
      z-index: 100;
      max-width: 300px;
    }
    
    .graph-overlay h3 {
      color: #58a6ff;
      font-size: 14px;
      margin-bottom: 12px;
      font-weight: 600;
    }
    
    .graph-overlay .legend-item {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
      font-size: 12px;
    }
    
    .legend-color {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      margin-right: 8px;
      border: 2px solid #30363d;
    }
    
    /* Panel Lateral */
    .sidebar {
      width: 500px;
      background: #161b22;
      border-left: 1px solid #21262d;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }
    
    /* Header del PR */
    .pr-header {
      background: linear-gradient(135deg, #21262d 0%, #161b22 100%);
      padding: 24px;
      border-bottom: 1px solid #30363d;
    }
    
    .pr-title {
      font-size: 20px;
      font-weight: 700;
      color: #f0f6fc;
      margin-bottom: 8px;
      line-height: 1.3;
    }
    
    .pr-meta {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 16px;
    }
    
    .pr-meta-item {
      display: flex;
      align-items: center;
      font-size: 13px;
      color: #8b949e;
    }
    
    .pr-meta-item svg {
      width: 16px;
      height: 16px;
      margin-right: 8px;
      flex-shrink: 0;
    }
    
    .pr-branches {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }
    
    .branch {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 6px 12px;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 12px;
      color: #c9d1d9;
    }
    
    .branch.source { border-color: #f85149; background: rgba(248, 81, 73, 0.1); }
    .branch.target { border-color: #238636; background: rgba(35, 134, 54, 0.1); }
    
    .pr-actions {
      display: flex;
      gap: 8px;
    }
    
    .btn-primary {
      flex: 1;
      background: #238636;
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    
    .btn-primary:hover {
      background: #2ea043;
    }
    
    /* Estadísticas */
    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      padding: 20px;
      background: #0d1117;
      border-bottom: 1px solid #21262d;
    }
    
    .stat-card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    
    .stat-card .icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 8px;
      font-size: 16px;
    }
    
    .stat-card.modified .icon { background: #f851491a; color: #f85149; }
    .stat-card.affected .icon { background: #d299221a; color: #d29922; }
    .stat-card.dependencies .icon { background: #58a6ff1a; color: #58a6ff; }
    .stat-card.total .icon { background: #2386361a; color: #238636; }
    
    .stat-card .value {
      font-size: 28px;
      font-weight: 700;
      color: #f0f6fc;
      margin-bottom: 4px;
    }
    
    .stat-card .label {
      font-size: 12px;
      color: #8b949e;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    
    /* Contenido Principal */
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    
    /* Filtros y Controles */
    .controls-section {
      padding: 16px 20px;
      background: #161b22;
      border-bottom: 1px solid #21262d;
    }
    
    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #f0f6fc;
      margin-bottom: 12px;
    }
    
    .filter-tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }
    
    .tab-btn {
      background: #21262d;
      border: 1px solid #30363d;
      color: #c9d1d9;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .tab-btn.active {
      background: #58a6ff;
      border-color: #58a6ff;
      color: #fff;
    }
    
    .control-buttons {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    
    .control-btn {
      background: #21262d;
      border: 1px solid #30363d;
      color: #c9d1d9;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    
    .control-btn:hover {
      background: #30363d;
      border-color: #58a6ff;
    }
    
    /* Panel de Detalles */
    .details-panel {
      flex: 1;
      padding: 20px;
      overflow-y: auto;
    }
    
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #8b949e;
    }
    
    .empty-state svg {
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
      opacity: 0.5;
    }
    
    .empty-state h3 {
      font-size: 16px;
      color: #f0f6fc;
      margin-bottom: 8px;
    }
    
    .empty-state p {
      font-size: 14px;
      line-height: 1.5;
    }
    
    /* Detalles del Archivo */
    .file-details {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 12px;
      overflow: hidden;
    }
    
    .file-header {
      padding: 16px 20px;
      background: #161b22;
      border-bottom: 1px solid #30363d;
    }
    
    .file-title {
      font-size: 16px;
      font-weight: 600;
      color: #58a6ff;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .file-path {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 12px;
      color: #8b949e;
      background: #0d1117;
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid #30363d;
      word-break: break-all;
    }
    
    .file-meta {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-top: 12px;
    }
    
    .meta-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }
    
    .meta-item .label {
      color: #8b949e;
      font-weight: 500;
    }
    
    .meta-item .value {
      color: #f0f6fc;
      font-weight: 600;
    }
    
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .badge.modified { background: #f851491a; color: #f85149; border: 1px solid #f85149; }
    .badge.affected { background: #d299221a; color: #d29922; border: 1px solid #d29922; }
    .badge.edit { background: #1f6feb1a; color: #1f6feb; border: 1px solid #1f6feb; }
    .badge.add { background: #2386361a; color: #238636; border: 1px solid #238636; }
    .badge.delete { background: #da36331a; color: #da3633; border: 1px solid #da3633; }
    
    /* Impact Section */
    .impact-section {
      margin-top: 20px;
      background: #161b22;
      border-radius: 8px;
      overflow: hidden;
    }
    
    .impact-header {
      padding: 12px 20px;
      background: #1c2128;
      border-bottom: 1px solid #30363d;
      font-size: 13px;
      font-weight: 600;
      color: #f0f6fc;
    }
    
    .impact-list {
      padding: 12px 20px;
    }
    
    .impact-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      margin-bottom: 8px;
      background: #0d1117;
      border-radius: 6px;
      border: 1px solid #21262d;
      transition: all 0.2s;
    }
    
    .impact-item:hover {
      border-color: #58a6ff;
      background: #161b22;
    }
    
    .impact-item:last-child {
      margin-bottom: 0;
    }
    
    .impact-file {
      font-size: 12px;
      color: #e6edf3;
      font-weight: 500;
    }
    
    .impact-line {
      font-size: 11px;
      color: #8b949e;
      font-family: 'SF Mono', Monaco, monospace;
      background: #21262d;
      padding: 2px 8px;
      border-radius: 4px;
    }
    
    /* Diff Section */
    .diff-section {
      margin-top: 20px;
    }
    
    .diff-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: #161b22;
      border-bottom: 1px solid #30363d;
    }
    
    .diff-title {
      font-size: 14px;
      font-weight: 600;
      color: #f0f6fc;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .diff-actions {
      display: flex;
      gap: 8px;
    }
    
    .action-btn {
      background: #21262d;
      border: 1px solid #30363d;
      color: #c9d1d9;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .action-btn:hover {
      background: #30363d;
      border-color: #58a6ff;
    }
    
    .diff-content {
      max-height: 500px;
      overflow-y: auto;
      background: #0d1117;
    }
    
    .diff-content pre {
      margin: 0;
      padding: 20px;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 12px;
      line-height: 1.6;
      overflow-x: auto;
    }
    
    .diff-content code {
      background: transparent;
    }
    
    .hljs {
      background: #0d1117 !important;
      color: #e6edf3;
    }
    
    .hljs-addition {
      background: rgba(35, 134, 54, 0.15);
      color: #56d364;
      display: block;
      margin: 0 -20px;
      padding: 0 20px;
      border-left: 3px solid #238636;
    }
    
    .hljs-deletion {
      background: rgba(248, 81, 73, 0.15);
      color: #f85149;
      display: block;
      margin: 0 -20px;
      padding: 0 20px;
      border-left: 3px solid #da3633;
    }
    
    .no-diff-message {
      padding: 40px 20px;
      text-align: center;
      color: #8b949e;
      background: #0d1117;
    }
    
    .no-diff-message svg {
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }
    
    /* Animations */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .file-details, .diff-section {
      animation: fadeIn 0.3s ease-out;
    }
    
    /* Responsive */
    @media (max-width: 1200px) {
      .sidebar { width: 350px; }
    }
    
    @media (max-width: 1000px) {
      .container { flex-direction: column; }
      .sidebar { width: 100%; height: 50vh; }
      #cy { height: 50vh; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Panel Principal - Grafo -->
    <div id="cy">
      <div class="graph-overlay">
        <h3>📊 Leyenda del Grafo</h3>
        <div class="legend-item">
          <div class="legend-color" style="background: #f85149;"></div>
          <span>Archivos Modificados</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: #d29922;"></div>
          <span>Archivos Afectados</span>
        </div>
        <div class="legend-item">
          <span style="margin-left: 24px;">Conexiones = Dependencias</span>
        </div>
      </div>
    </div>
    
    <!-- Panel Lateral -->
    <div class="sidebar">
      <!-- Header del PR -->
      <div class="pr-header">
        <div class="pr-title">PR #${graph.meta.prId}</div>
        <div class="pr-meta">
          <div class="pr-meta-item">
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
              <path fill-rule="evenodd" d="M8 0a8 8 0 100 16A8 8 0 000 8a8 8 0 000-16zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z"/>
            </svg>
            ${graph.meta.prTitle}
          </div>
          <div class="pr-meta-item">
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.536 3.464a5 5 0 010 7.072L8 8.536l-3.536 1.928a5 5 0 010-7.072L8 7.464l3.536-1.928z"/>
            </svg>
            Rama: ${graph.meta.head} → ${graph.meta.base}
          </div>
        </div>
        
        <div class="pr-branches">
          <span class="branch source">${graph.meta.head}</span>
          <span class="branch target">${graph.meta.base}</span>
        </div>
      </div>
      
      <!-- Estadísticas -->
      <div class="stats-grid">
        <div class="stat-card modified">
          <div class="icon">📝</div>
          <div class="value">${graph.meta.stats.modifiedFiles}</div>
          <div class="label">Modificados</div>
        </div>
        <div class="stat-card affected">
          <div class="icon">⚡</div>
          <div class="value">${graph.meta.stats.affectedFiles}</div>
          <div class="label">Afectados</div>
        </div>
        <div class="stat-card dependencies">
          <div class="icon">🔗</div>
          <div class="value">${graph.meta.stats.dependencies}</div>
          <div class="label">Dependencias</div>
        </div>
        <div class="stat-card total">
          <div class="icon">📊</div>
          <div class="value">${graph.meta.stats.totalFiles}</div>
          <div class="label">Total</div>
        </div>
      </div>
      
      <!-- Contenido Principal -->
      <div class="main-content">
        <!-- Controles -->
        <div class="controls-section">
          <div class="section-title">🎛️ Controles del Grafo</div>
          <div class="filter-tabs">
            <button class="tab-btn active" onclick="filterNodes('all')">Todos</button>
            <button class="tab-btn" onclick="filterNodes('modified')">Modificados</button>
            <button class="tab-btn" onclick="filterNodes('affected')">Afectados</button>
          </div>
          <div class="control-buttons">
            <button class="control-btn" onclick="resetView()">🔄 Reset</button>
            <button class="control-btn" onclick="fitToScreen()">📐 Ajustar</button>
            <button class="control-btn" onclick="toggleLayout()">🔀 Layout</button>
          </div>
        </div>
        
        <!-- Panel de Detalles -->
        <div class="details-panel">
          <div id="node-info">
            <div class="empty-state">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
              <h3>Haz clic en un archivo</h3>
              <p>Selecciona cualquier nodo del grafo para ver sus detalles, cambios y dependencias.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    const graphData = ${JSON.stringify(graph, null, 2)};
    
    const elements = [
      ...graphData.nodes.map(node => ({
        data: {
          id: node.id,
          label: node.label,
          modified: node.modified,
          status: node.status,
          url: node.url,
          diff: node.diff
        }
      })),
      ...graphData.edges.map(edge => ({
        data: {
          source: edge.from,
          target: edge.to,
          type: edge.type || 'imports',
          line: edge.line
        }
      }))
    ];
    
    let currentLayout = 'cose';
    let currentFilter = 'all';
    
    const cy = cytoscape({
      container: document.getElementById('cy'),
      elements: elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#21262d',
            'border-width': 2,
            'border-color': '#30363d',
            'label': 'data(label)',
            'color': '#e6edf3',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '11px',
            'width': 45,
            'height': 45,
            'font-weight': '500'
          }
        },
        {
          selector: 'node[modified = true]',
          style: {
            'background-color': '#f85149',
            'border-color': '#da3633',
            'border-width': 3
          }
        },
        {
          selector: 'node[modified = false]',
          style: {
            'background-color': '#d29922',
            'border-color': '#bb8009'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#30363d',
            'target-arrow-color': '#30363d',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 1.2
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#58a6ff',
            'border-width': 4,
            'background-color': (ele) => ele.data('modified') ? '#f85149' : '#d29922'
          }
        },
        {
          selector: '.highlighted',
          style: {
            'background-color': '#58a6ff',
            'line-color': '#58a6ff',
            'target-arrow-color': '#58a6ff',
            'border-color': '#58a6ff'
          }
        },
        {
          selector: '.dimmed',
          style: {
            'opacity': 0.3
          }
        }
      ],
      layout: {
        name: 'cose',
        animate: true,
        animationDuration: 500,
        nodeRepulsion: 10000,
        idealEdgeLength: 120,
        edgeElasticity: 100,
        gravity: 0.1
      }
    });
    
    // Funciones de filtro
    function filterNodes(filter) {
      currentFilter = filter;
      
      // Actualizar botones
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      event.target.classList.add('active');
      
      // Aplicar filtro
      if (filter === 'all') {
        cy.elements().removeClass('dimmed');
      } else if (filter === 'modified') {
        cy.elements('node[modified = true]').removeClass('dimmed');
        cy.elements('node[modified = false]').addClass('dimmed');
      } else if (filter === 'affected') {
        cy.elements('node[modified = false]').removeClass('dimmed');
        cy.elements('node[modified = true]').addClass('dimmed');
      }
      
      cy.fit();
    }
    
    // Evento de selección de nodo
    cy.on('tap', 'node', function(evt) {
      const node = evt.target;
      const data = node.data();
      
      cy.elements().removeClass('highlighted').removeClass('dimmed');
      
      // Resaltar nodo seleccionado y conexiones
      node.addClass('highlighted');
      node.connectedEdges().addClass('highlighted');
      node.neighborhood('node').addClass('highlighted');
      
      // Aplicar filtro actual si no es 'all'
      if (currentFilter === 'modified') {
        cy.elements('node[modified = false]').addClass('dimmed');
      } else if (currentFilter === 'affected') {
        cy.elements('node[modified = true]').addClass('dimmed');
      }
      
      // Buscar datos completos del nodo
      const fullNode = graphData.nodes.find(n => n.id === data.id);
      const hasDiff = fullNode && fullNode.diff;
      
      // Generar contenido del panel de detalles
      const statusBadge = data.modified 
        ? '<span class="badge modified">Modificado</span>'
        : '<span class="badge affected">Afectado</span>';
      
      const changeTypeBadge = data.status 
        ? '<span class="badge ' + data.status + '">' + data.status.toUpperCase() + '</span>'
        : '';
      
      const azureLink = data.url 
        ? '<a href="' + data.url + '" target="_blank" class="btn-primary" style="margin-top: 16px;">🔗 Ver en Azure DevOps</a>'
        : '';
      
      const incoming = node.incomers('node').length;
      const outgoing = node.outgoers('node').length;
      
      // Obtener información de dependencias con líneas
      const incomingEdges = node.incomers('edge').map(edge => ({
        from: edge.data('source'),
        line: edge.data('line')
      }));
      
      const outgoingEdges = node.outgoers('edge').map(edge => ({
        to: edge.data('target'),
        line: edge.data('line')
      }));
      
      // Contenido principal del archivo
      let detailsContent = '<div class="file-details">' +
        '<div class="file-header">' +
          '<div class="file-title">' +
            '📄 ' + data.label +
            ' ' + statusBadge + ' ' + changeTypeBadge +
          '</div>' +
          '<div class="file-path">' + data.id + '</div>' +
          '<div class="file-meta">' +
            '<div class="meta-item">' +
              '<span class="label">Entrantes:</span>' +
              '<span class="value">' + incoming + '</span>' +
            '</div>' +
            '<div class="meta-item">' +
              '<span class="label">Salientes:</span>' +
              '<span class="value">' + outgoing + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
      
      // Agregar sección de archivos que usan este archivo (si está modificado)
      if (data.modified && incomingEdges.length > 0) {
        detailsContent += '<div class="impact-section">' +
          '<div class="impact-header">⚡ Archivos Afectados</div>' +
          '<div class="impact-list">';
        
        incomingEdges.forEach(edge => {
          const edgeNode = cy.getElementById(edge.from);
          if (edgeNode.length > 0) {
            const edgeData = edgeNode.data();
            const lineInfo = edge.line ? ' (línea ' + edge.line + ')' : '';
            detailsContent += '<div class="impact-item">' +
              '<span class="impact-file">' + edgeData.label + '</span>' +
              '<span class="impact-line">' + lineInfo + '</span>' +
            '</div>';
          }
        });
        
        detailsContent += '</div></div>';
      }
      
      // Agregar sección de archivos que este archivo usa (si está afectado)
      if (!data.modified && outgoingEdges.length > 0) {
        detailsContent += '<div class="impact-section">' +
          '<div class="impact-header">📦 Usa Archivos Modificados</div>' +
          '<div class="impact-list">';
        
        outgoingEdges.forEach(edge => {
          const edgeNode = cy.getElementById(edge.to);
          if (edgeNode.length > 0) {
            const edgeData = edgeNode.data();
            const lineInfo = edge.line ? ' en línea ' + edge.line : '';
            detailsContent += '<div class="impact-item">' +
              '<span class="impact-file">' + edgeData.label + '</span>' +
              '<span class="impact-line">' + lineInfo + '</span>' +
            '</div>';
          }
        });
        
        detailsContent += '</div></div>';
      }
      
      // Agregar sección de diff si existe
      if (hasDiff) {
        const escapedDiff = fullNode.diff
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
        
        const safeNodeId = data.id.replace(/[^a-zA-Z0-9]/g, '_');
        
        detailsContent += '<div class="diff-section">' +
          '<div class="diff-header">' +
            '<div class="diff-title">📝 Cambios en el archivo</div>' +
            '<div class="diff-actions">' +
              '<button class="action-btn" data-node-id="' + data.id + '" data-action="copy">📋 Copiar</button>' +
              '<button class="action-btn" data-node-id="' + data.id + '" data-action="expand">🔍 Expandir</button>' +
            '</div>' +
          '</div>' +
          '<div class="diff-content">' +
            '<pre><code class="language-diff" id="diff-' + safeNodeId + '">' + escapedDiff + '</code></pre>' +
          '</div>' +
        '</div>';
      } else if (data.modified && data.status === 'edit') {
        detailsContent += '<div class="diff-section">' +
          '<div class="no-diff-message">' +
            '<svg viewBox="0 0 24 24" fill="currentColor">' +
              '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>' +
            '</svg>' +
            '<p>No se pudieron obtener los cambios para este archivo</p>' +
          '</div>' +
        '</div>';
      }
      
      document.getElementById('node-info').innerHTML = detailsContent;
      
      // Agregar event listeners a los botones de acción
      document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
          const nodeId = this.getAttribute('data-node-id');
          const action = this.getAttribute('data-action');
          
          if (action === 'copy') {
            copyDiff(nodeId, this);
          } else if (action === 'expand') {
            expandDiff(nodeId, this);
          }
        });
      });
      
      // Aplicar resaltado de sintaxis al diff
      if (hasDiff) {
        const diffCodeId = 'diff-' + data.id.replace(/[^a-zA-Z0-9]/g, '_');
        const codeElement = document.getElementById(diffCodeId);
        if (codeElement) {
          hljs.highlightElement(codeElement);
        }
      }
    });
    
    // Evento de deselección
    cy.on('tap', function(evt) {
      if (evt.target === cy) {
        cy.elements().removeClass('highlighted').removeClass('dimmed');
        
        // Reaplicar filtro actual
        if (currentFilter === 'modified') {
          cy.elements('node[modified = false]').addClass('dimmed');
        } else if (currentFilter === 'affected') {
          cy.elements('node[modified = true]').addClass('dimmed');
        }
      }
    });
    
    // Funciones de control
    function resetView() {
      cy.fit();
      cy.center();
      cy.elements().removeClass('highlighted').removeClass('dimmed');
      
      // Reaplicar filtro
      if (currentFilter === 'modified') {
        cy.elements('node[modified = false]').addClass('dimmed');
      } else if (currentFilter === 'affected') {
        cy.elements('node[modified = true]').addClass('dimmed');
      }
    }
    
    function fitToScreen() {
      cy.fit();
    }
    
    function toggleLayout() {
      const layouts = ['cose', 'circle', 'grid', 'breadthfirst', 'concentric'];
      const currentIndex = layouts.indexOf(currentLayout);
      currentLayout = layouts[(currentIndex + 1) % layouts.length];
      
      cy.layout({
        name: currentLayout,
        animate: true,
        animationDuration: 500
      }).run();
    }
    
    function copyDiff(nodeId, btn) {
      const fullNode = graphData.nodes.find(n => n.id === nodeId);
      if (fullNode && fullNode.diff) {
        navigator.clipboard.writeText(fullNode.diff).then(() => {
          const originalText = btn.textContent;
          btn.textContent = '✅ Copiado';
          btn.style.background = '#238636';
          setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '#21262d';
          }, 2000);
        }).catch(err => {
          console.error('Error al copiar:', err);
        });
      }
    }
    
    function expandDiff(nodeId, btn) {
      const safeId = nodeId.replace(/[^a-zA-Z0-9]/g, '_');
      const diffElement = document.querySelector('#diff-' + safeId);
      
      if (!diffElement) {
        console.error('No se encontró el elemento diff para:', nodeId);
        return;
      }
      
      const diffContent = diffElement.closest('.diff-content');
      
      if (!diffContent) {
        console.error('No se encontró .diff-content para:', nodeId);
        return;
      }
      
      // Verificar si está expandido (maxHeight es 'none' o no está establecido)
      const isExpanded = diffContent.style.maxHeight === 'none' || diffContent.style.maxHeight === '';
      
      if (isExpanded) {
        // Contraer
        diffContent.style.maxHeight = '500px';
        btn.textContent = '🔍 Expandir';
      } else {
        // Expandir
        diffContent.style.maxHeight = 'none';
        btn.textContent = '🔽 Contraer';
      }
    }
  </script>
</body>
</html>`;

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

    console.log(chalk.cyan(`\nAnalizando PR #${options.prId} en ${repoInfo.organization}/${repoInfo.project}/${repoInfo.repository}...`));

    const prDetails = await fetchPullRequestDetails({
      organization: repoInfo.organization,
      project: repoInfo.project,
      repository: repoInfo.repository,
      pat: azureConfig.pat,
      pullRequestId: options.prId
    });

    console.log(chalk.blue(`PR: ${prDetails.title}`));
    console.log(chalk.gray(`Estado: ${prDetails.status} | Creado por: ${prDetails.createdBy}`));
    console.log(chalk.gray(`Rama: ${prDetails.sourceRefName} → ${prDetails.targetRefName}`));

    // Obtener la ruta raíz del repositorio
    const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();

    // Generar grafo de impacto
    const impactGraph = generateImpactGraph(prDetails, repoRoot);

    console.log(chalk.cyan(`\nAnalizando dependencias...`));

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
      console.log(chalk.cyan('\n📝 Archivos modificados en el PR:'));
      modifiedNodes.forEach((node) => {
        const changeTypeIcon = node.status === 'add' ? chalk.green('➕') :
                              node.status === 'edit' ? chalk.blue('✏️') :
                              node.status === 'delete' ? chalk.red('🗑️') : chalk.gray('❓');
        console.log(`  ${changeTypeIcon} ${node.id}`);
      });
    }

    // Mostrar archivos afectados
    const affectedNodes = impactGraph.nodes.filter(n => !n.modified);
    if (affectedNodes.length > 0) {
      console.log(chalk.yellow(`\n⚠️  Archivos afectados (importan los modificados):`));
      affectedNodes.slice(0, 10).forEach((node) => {
        console.log(`  ${chalk.yellow('⚡')} ${node.id}`);
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
