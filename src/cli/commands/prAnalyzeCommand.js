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
      background: #0d1117;
      color: #c9d1d9;
      overflow: hidden;
    }
    
    .container {
      display: flex;
      height: 100vh;
    }
    
    #cy {
      flex: 1;
      background: #0d1117;
    }
    
    .sidebar {
      width: 350px;
      background: #161b22;
      border-left: 1px solid #30363d;
      overflow-y: auto;
      padding: 20px;
    }
    
    .header {
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid #30363d;
    }
    
    .header h1 {
      font-size: 18px;
      margin-bottom: 8px;
      color: #58a6ff;
    }
    
    .header .pr-info {
      font-size: 13px;
      color: #8b949e;
      margin-bottom: 4px;
    }
    
    .stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 20px;
    }
    
    .stat-card {
      background: #0d1117;
      padding: 12px;
      border-radius: 6px;
      border: 1px solid #30363d;
    }
    
    .stat-card .label {
      font-size: 11px;
      color: #8b949e;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    
    .stat-card .value {
      font-size: 24px;
      font-weight: bold;
      color: #c9d1d9;
    }
    
    .stat-card.modified .value { color: #f85149; }
    .stat-card.affected .value { color: #d29922; }
    .stat-card.deps .value { color: #58a6ff; }
    
    .node-details {
      background: #0d1117;
      padding: 15px;
      border-radius: 6px;
      border: 1px solid #30363d;
      margin-bottom: 15px;
    }
    
    .node-details h3 {
      font-size: 14px;
      margin-bottom: 10px;
      color: #58a6ff;
    }
    
    .node-details .detail-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 13px;
    }
    
    .node-details .detail-label {
      color: #8b949e;
    }
    
    .node-details .detail-value {
      color: #c9d1d9;
      font-weight: 500;
    }
    
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }
    
    .badge.modified {
      background: #f851491a;
      color: #f85149;
      border: 1px solid #f85149;
    }
    
    .badge.affected {
      background: #d299221a;
      color: #d29922;
      border: 1px solid #d29922;
    }
    
    .badge.add { background: #238636; color: #fff; }
    .badge.edit { background: #1f6feb; color: #fff; }
    .badge.delete { background: #da3633; color: #fff; }
    
    .link-btn {
      display: inline-block;
      padding: 6px 12px;
      background: #238636;
      color: #fff;
      text-decoration: none;
      border-radius: 6px;
      font-size: 12px;
      margin-top: 10px;
      transition: background 0.2s;
    }
    
    .link-btn:hover {
      background: #2ea043;
    }
    
    .controls {
      margin-bottom: 15px;
    }
    
    .controls button {
      width: 100%;
      padding: 8px;
      background: #21262d;
      color: #c9d1d9;
      border: 1px solid #30363d;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      margin-bottom: 8px;
      transition: background 0.2s;
    }
    
    .controls button:hover {
      background: #30363d;
    }
    
    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: #8b949e;
    }
    
    .empty-state svg {
      width: 48px;
      height: 48px;
      margin-bottom: 12px;
      opacity: 0.5;
    }
    
    .diff-container {
      margin-top: 15px;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      overflow: hidden;
    }
    
    .diff-header {
      padding: 10px 15px;
      background: #161b22;
      border-bottom: 1px solid #30363d;
      font-size: 12px;
      font-weight: 600;
      color: #58a6ff;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .diff-content {
      max-height: 400px;
      overflow-y: auto;
      font-size: 12px;
      line-height: 1.5;
    }
    
    .diff-content pre {
      margin: 0;
      padding: 15px;
      background: #0d1117;
      overflow-x: auto;
    }
    
    .diff-content code {
      font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
      font-size: 12px;
    }
    
    .hljs {
      background: #0d1117 !important;
      color: #c9d1d9;
    }
    
    .hljs-addition {
      background: #23863633;
      color: #7ee787;
      display: block;
    }
    
    .hljs-deletion {
      background: #da363333;
      color: #ffa198;
      display: block;
    }
    
    .no-diff-message {
      padding: 20px;
      text-align: center;
      color: #8b949e;
      font-size: 13px;
    }
    
    .copy-btn {
      background: #21262d;
      border: 1px solid #30363d;
      color: #c9d1d9;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .copy-btn:hover {
      background: #30363d;
    }
  </style>
</head>
<body>
  <div class="container">
    <div id="cy"></div>
    <div class="sidebar">
      <div class="header">
        <h1>PR #${graph.meta.prId}</h1>
        <div class="pr-info">${graph.meta.prTitle}</div>
        <div class="pr-info">${graph.meta.head} → ${graph.meta.base}</div>
      </div>
      
      <div class="stats">
        <div class="stat-card modified">
          <div class="label">Modificados</div>
          <div class="value">${graph.meta.stats.modifiedFiles}</div>
        </div>
        <div class="stat-card affected">
          <div class="label">Afectados</div>
          <div class="value">${graph.meta.stats.affectedFiles}</div>
        </div>
        <div class="stat-card deps">
          <div class="label">Dependencias</div>
          <div class="value">${graph.meta.stats.dependencies}</div>
        </div>
        <div class="stat-card">
          <div class="label">Total</div>
          <div class="value">${graph.meta.stats.totalFiles}</div>
        </div>
      </div>
      
      <div class="controls">
        <button onclick="resetView()">🔄 Resetear Vista</button>
        <button onclick="fitToScreen()">📐 Ajustar a Pantalla</button>
        <button onclick="toggleLayout()">🔀 Cambiar Layout</button>
      </div>
      
      <div id="node-info">
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <p>Haz clic en un nodo para ver detalles</p>
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
          url: node.url
        }
      })),
      ...graphData.edges.map(edge => ({
        data: {
          source: edge.from,
          target: edge.to,
          type: edge.type || 'imports'
        }
      }))
    ];
    
    let currentLayout = 'cose';
    
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
            'color': '#c9d1d9',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '10px',
            'width': 40,
            'height': 40
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
            'arrow-scale': 1
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#58a6ff',
            'border-width': 4
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
        }
      ],
      layout: {
        name: 'cose',
        animate: true,
        animationDuration: 500,
        nodeRepulsion: 8000,
        idealEdgeLength: 100,
        edgeElasticity: 100
      }
    });
    
    cy.on('tap', 'node', function(evt) {
      const node = evt.target;
      const data = node.data();
      
      cy.elements().removeClass('highlighted');
      
      node.addClass('highlighted');
      node.connectedEdges().addClass('highlighted');
      node.neighborhood('node').addClass('highlighted');
      
      const statusBadge = data.modified 
        ? '<span class="badge modified">Modificado</span>'
        : '<span class="badge affected">Afectado</span>';
      
      const changeTypeBadge = data.status 
        ? \`<span class="badge \${data.status}">\${data.status.toUpperCase()}</span>\`
        : '';
      
      const azureLink = data.url 
        ? \`<a href="\${data.url}" target="_blank" class="link-btn">🔗 Ver en Azure DevOps</a>\`
        : '';
      
      const incoming = node.incomers('node').length;
      const outgoing = node.outgoers('node').length;
      
      // Buscar el nodo completo en graphData para obtener el diff
      const fullNode = graphData.nodes.find(n => n.id === data.id);
      const hasDiff = fullNode && fullNode.diff;
      
      let diffSection = '';
      if (hasDiff) {
        const escapedDiff = fullNode.diff
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
        
        diffSection = \`
          <div class="diff-container">
            <div class="diff-header">
              <span>📝 Cambios en el archivo</span>
              <button class="copy-btn" onclick="copyDiff('\${data.id}')">Copiar</button>
            </div>
            <div class="diff-content">
              <pre><code class="language-diff" id="diff-\${data.id.replace(/[^a-zA-Z0-9]/g, '_')}">\${escapedDiff}</code></pre>
            </div>
          </div>
        \`;
      } else if (data.modified && data.status === 'edit') {
        diffSection = \`
          <div class="diff-container">
            <div class="no-diff-message">
              ℹ️ No se pudo obtener el diff para este archivo
            </div>
          </div>
        \`;
      }
      
      document.getElementById('node-info').innerHTML = \`
        <div class="node-details">
          <h3>\${data.label}</h3>
          <div class="detail-row">
            <span class="detail-label">Ruta:</span>
            <span class="detail-value" style="font-size: 11px; word-break: break-all;">\${data.id}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Estado:</span>
            <span>\${statusBadge} \${changeTypeBadge}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Dependencias entrantes:</span>
            <span class="detail-value">\${incoming}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Dependencias salientes:</span>
            <span class="detail-value">\${outgoing}</span>
          </div>
          \${azureLink}
        </div>
        \${diffSection}
      \`;
      
      // Aplicar resaltado de sintaxis al diff
      if (hasDiff) {
        const diffCodeId = 'diff-' + data.id.replace(/[^a-zA-Z0-9]/g, '_');
        const codeElement = document.getElementById(diffCodeId);
        if (codeElement) {
          hljs.highlightElement(codeElement);
        }
      }
    });
    
    cy.on('tap', function(evt) {
      if (evt.target === cy) {
        cy.elements().removeClass('highlighted');
      }
    });
    
    function resetView() {
      cy.fit();
      cy.center();
      cy.elements().removeClass('highlighted');
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
    
    function copyDiff(nodeId) {
      const fullNode = graphData.nodes.find(n => n.id === nodeId);
      if (fullNode && fullNode.diff) {
        navigator.clipboard.writeText(fullNode.diff).then(() => {
          const btn = event.target;
          const originalText = btn.textContent;
          btn.textContent = '✓ Copiado';
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
    mermaid += `  ${id}["${label}"]${style}\n`;
  });
  
  mermaid += '\n';
  
  graph.edges.forEach(edge => {
    const fromId = edge.from.replace(/[^a-zA-Z0-9]/g, '_');
    const toId = edge.to.replace(/[^a-zA-Z0-9]/g, '_');
    mermaid += `  ${fromId} --> ${toId}\n`;
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

    // Guardar el archivo JSON
    const outputFile = options.output || 'graph.json';
    fs.writeFileSync(outputFile, JSON.stringify(impactGraph, null, 2));

    console.log(chalk.green(`\n✓ Grafo de impacto generado en: ${outputFile}`));
    console.log(chalk.gray(`Archivos modificados: ${impactGraph.meta.stats.modifiedFiles} | Archivos afectados: ${impactGraph.meta.stats.affectedFiles} | Dependencias: ${impactGraph.meta.stats.dependencies}`));

    // Generar visualización HTML si se solicita
    if (options.html) {
      const htmlFile = outputFile.replace('.json', '.html');
      generateVisualization(impactGraph, htmlFile);
      console.log(chalk.green(`\n✓ Visualización HTML generada en: ${htmlFile}`));
      console.log(chalk.gray('Abre el archivo en tu navegador para explorar el grafo interactivo'));
      
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
      const mermaidFile = outputFile.replace('.json', '.mmd');
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
