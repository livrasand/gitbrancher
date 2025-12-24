const fs = require('fs');
const path = require('path');

/**
 * Analiza las dependencias entre archivos detectando imports/exports
 * @param {Array} files - Lista de archivos modificados con sus paths
 * @param {string} repoRoot - Ruta raíz del repositorio
 * @param {Object} options - Opciones de análisis
 * @param {boolean} options.includeReverseDeps - Incluir archivos que importan los modificados
 * @param {number} options.maxDepth - Profundidad máxima para buscar dependencias reversas
 * @returns {Object} { edges, affectedFiles }
 */
function analyzeDependencies(files, repoRoot, options = {}) {
  const { includeReverseDeps = true, maxDepth = 2 } = options;
  const edges = [];
  const fileMap = new Map(files.map(f => [f.path, f]));
  const affectedFiles = new Set();

  // Analizar imports directos entre archivos modificados
  files.forEach(file => {
    try {
      const fullPath = path.join(repoRoot, file.path);
      
      if (!fs.existsSync(fullPath)) {
        return;
      }

      const content = fs.readFileSync(fullPath, 'utf-8');
      const imports = extractImports(content, file.path);

      imports.forEach(importPath => {
        const resolvedPath = resolveImportPath(importPath, file.path, repoRoot);
        
        if (resolvedPath && fileMap.has(resolvedPath)) {
          edges.push({
            from: file.path,
            to: resolvedPath,
            relation: 'imports'
          });
        }
      });
    } catch (error) {
      // Ignorar archivos que no se pueden leer
    }
  });

  // Analizar dependencias reversas (archivos que importan los modificados)
  if (includeReverseDeps) {
    const modifiedPaths = new Set(files.map(f => f.path));
    findReverseDependencies(modifiedPaths, repoRoot, affectedFiles, edges, maxDepth);
  }

  return { edges, affectedFiles: Array.from(affectedFiles) };
}

/**
 * Extrae los imports de un archivo según su tipo
 * @param {string} content - Contenido del archivo
 * @param {string} filePath - Path del archivo
 * @returns {Array<string>} Lista de paths importados
 */
function extractImports(content, filePath) {
  const imports = [];
  const ext = path.extname(filePath).toLowerCase();

  // JavaScript/TypeScript/Svelte
  if (['.js', '.ts', '.jsx', '.tsx', '.svelte', '.mjs', '.cjs'].includes(ext)) {
    // import ... from '...'
    const importRegex = /import\s+(?:[\w{},\s*]+\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // require('...')
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // dynamic import()
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
  }

  // CSS/SCSS
  if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
    // @import '...'
    const cssImportRegex = /@import\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = cssImportRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
  }

  return imports;
}

/**
 * Resuelve un path de import relativo a un path absoluto del repositorio
 * @param {string} importPath - Path del import (puede ser relativo o absoluto)
 * @param {string} fromFile - Path del archivo que hace el import
 * @param {string} repoRoot - Ruta raíz del repositorio
 * @returns {string|null} Path absoluto resuelto o null si no se puede resolver
 */
function resolveImportPath(importPath, fromFile, repoRoot) {
  // Ignorar imports de node_modules
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return null;
  }

  const fromDir = path.dirname(fromFile);
  let resolvedPath;

  if (importPath.startsWith('.')) {
    // Import relativo
    resolvedPath = path.normalize(path.join(fromDir, importPath));
  } else {
    // Import absoluto desde la raíz del repo
    resolvedPath = path.normalize(importPath);
  }

  // Intentar con diferentes extensiones si no tiene extensión
  if (!path.extname(resolvedPath)) {
    const extensions = ['.js', '.ts', '.jsx', '.tsx', '.svelte', '.json', '.css', '.scss'];
    for (const ext of extensions) {
      const withExt = resolvedPath + ext;
      const fullPath = path.join(repoRoot, withExt);
      if (fs.existsSync(fullPath)) {
        return withExt;
      }
    }

    // Intentar con index
    for (const ext of extensions) {
      const withIndex = path.join(resolvedPath, 'index' + ext);
      const fullPath = path.join(repoRoot, withIndex);
      if (fs.existsSync(fullPath)) {
        return withIndex;
      }
    }
  }

  // Verificar que el archivo existe
  const fullPath = path.join(repoRoot, resolvedPath);
  if (fs.existsSync(fullPath)) {
    return resolvedPath;
  }

  return null;
}

/**
 * Encuentra archivos que importan los archivos modificados (dependencias reversas)
 * @param {Set} modifiedPaths - Paths de archivos modificados
 * @param {string} repoRoot - Ruta raíz del repositorio
 * @param {Set} affectedFiles - Set para acumular archivos afectados
 * @param {Array} edges - Array para acumular edges
 * @param {number} maxDepth - Profundidad máxima de búsqueda
 */
function findReverseDependencies(modifiedPaths, repoRoot, affectedFiles, edges, maxDepth = 2) {
  const searchDirs = [
    path.join(repoRoot, 'src'),
    path.join(repoRoot, 'frontend'),
    path.join(repoRoot, 'backend'),
    path.join(repoRoot, 'app'),
    path.join(repoRoot, 'lib')
  ].filter(dir => fs.existsSync(dir));

  if (searchDirs.length === 0) {
    searchDirs.push(repoRoot);
  }

  const visited = new Set();
  const queue = Array.from(modifiedPaths).map(p => ({ path: p, depth: 0 }));

  while (queue.length > 0) {
    const { path: currentPath, depth } = queue.shift();

    if (depth >= maxDepth) continue;

    searchDirs.forEach(searchDir => {
      scanDirectory(searchDir, (filePath) => {
        if (visited.has(filePath)) return;
        visited.add(filePath);

        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const imports = extractImports(content, filePath);

          imports.forEach(importPath => {
            const resolvedPath = resolveImportPath(importPath, filePath, repoRoot);
            
            if (resolvedPath === currentPath) {
              const relativePath = filePath.replace(repoRoot, '');
              
              if (!modifiedPaths.has(relativePath)) {
                affectedFiles.add(relativePath);
                edges.push({
                  from: relativePath,
                  to: currentPath,
                  relation: 'imports'
                });

                queue.push({ path: relativePath, depth: depth + 1 });
              }
            }
          });
        } catch (error) {
          // Ignorar archivos que no se pueden leer
        }
      });
    });
  }
}

/**
 * Escanea un directorio recursivamente buscando archivos de código
 * @param {string} dir - Directorio a escanear
 * @param {Function} callback - Función a llamar por cada archivo encontrado
 */
function scanDirectory(dir, callback) {
  if (!fs.existsSync(dir)) return;

  const validExtensions = ['.js', '.ts', '.jsx', '.tsx', '.svelte', '.vue', '.css', '.scss'];
  const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    entries.forEach(entry => {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!ignoreDirs.includes(entry.name)) {
          scanDirectory(fullPath, callback);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (validExtensions.includes(ext)) {
          callback(fullPath);
        }
      }
    });
  } catch (error) {
    // Ignorar errores de permisos
  }
}

module.exports = {
  analyzeDependencies,
  extractImports,
  resolveImportPath,
  findReverseDependencies,
  scanDirectory
};
