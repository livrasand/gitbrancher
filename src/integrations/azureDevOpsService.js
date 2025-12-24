const axios = require('axios');

/**
 * Clase de error personalizada para errores de Azure DevOps
 */
class AzureDevOpsError extends Error {
  constructor(message, statusCode = null, originalError = null, isRetryable = false) {
    super(message);
    this.name = 'AzureDevOpsError';
    this.statusCode = statusCode;
    this.originalError = originalError;
    this.isRetryable = isRetryable;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Configuración por defecto para reintentos y timeouts
 */
const DEFAULT_CONFIG = {
  maxRetries: 3,
  initialRetryDelay: 1000, // 1 segundo
  maxRetryDelay: 10000, // 10 segundos
  timeout: 30000, // 30 segundos
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

/**
 * Valida que el PAT tenga un formato básico válido
 * @param {string} pat - Token personal de Azure DevOps
 * @throws {AzureDevOpsError} Si el PAT no es válido
 */
function validatePAT(pat) {
  if (!pat || typeof pat !== 'string') {
    throw new AzureDevOpsError('El PAT debe ser una cadena de texto válida', null, null, false);
  }

  if (pat.trim().length === 0) {
    throw new AzureDevOpsError('El PAT no puede estar vacío', null, null, false);
  }

  // Azure DevOps PATs suelen tener 52 caracteres
  if (pat.length < 20) {
    throw new AzureDevOpsError('El PAT parece ser demasiado corto. Verifica que sea correcto.', null, null, false);
  }
}

/**
 * Valida los parámetros requeridos para las consultas
 * @param {Object} params - Parámetros a validar
 * @throws {AzureDevOpsError} Si algún parámetro es inválido
 */
function validateParameters({ organization, project, pat, top, repository = null }) {
  if (!organization || typeof organization !== 'string' || organization.trim().length === 0) {
    throw new AzureDevOpsError('La organización debe ser una cadena de texto válida', null, null, false);
  }

  if (!project || typeof project !== 'string' || project.trim().length === 0) {
    throw new AzureDevOpsError('El proyecto debe ser una cadena de texto válida', null, null, false);
  }

  if (repository !== null && (!repository || typeof repository !== 'string' || repository.trim().length === 0)) {
    throw new AzureDevOpsError('El repositorio debe ser una cadena de texto válida', null, null, false);
  }

  validatePAT(pat);

  if (top !== undefined && (typeof top !== 'number' || top < 1 || top > 200)) {
    throw new AzureDevOpsError('El parámetro "top" debe ser un número entre 1 y 200', null, null, false);
  }
}

/**
 * Calcula el delay para el siguiente reintento usando backoff exponencial
 * @param {number} attempt - Número de intento actual (0-indexed)
 * @param {number} initialDelay - Delay inicial en ms
 * @param {number} maxDelay - Delay máximo en ms
 * @returns {number} Delay en milisegundos
 */
function calculateBackoff(attempt, initialDelay, maxDelay) {
  const exponentialDelay = initialDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // ±30% jitter
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Determina si un error es reintentable
 * @param {Error} error - Error de Axios
 * @param {Array<number>} retryableStatusCodes - Códigos de estado reintentables
 * @returns {boolean} True si el error es reintentable
 */
function isRetryableError(error, retryableStatusCodes) {
  // Errores de red (sin respuesta)
  if (!error.response) {
    return true;
  }

  const statusCode = error.response.status;

  // Códigos de estado específicamente reintentables
  if (retryableStatusCodes.includes(statusCode)) {
    return true;
  }

  return false;
}

/**
 * Maneja errores de Axios y los convierte en AzureDevOpsError
 * @param {Error} error - Error de Axios
 * @param {string} context - Contexto donde ocurrió el error
 * @returns {AzureDevOpsError} Error formateado
 */
function handleAxiosError(error, context = 'Azure DevOps API') {
  if (error.response) {
    const statusCode = error.response.status;
    const data = error.response.data;

    switch (statusCode) {
      case 401:
        return new AzureDevOpsError(
          'Autenticación fallida. El PAT puede ser inválido o haber expirado. Por favor, verifica tu token.',
          statusCode,
          error,
          false
        );

      case 403:
        return new AzureDevOpsError(
          'Acceso denegado. El PAT no tiene los permisos necesarios para esta operación.',
          statusCode,
          error,
          false
        );

      case 404:
        return new AzureDevOpsError(
          `Recurso no encontrado. Verifica que la organización, proyecto o equipo existan. (${context})`,
          statusCode,
          error,
          false
        );

      case 429:
        const retryAfter = error.response.headers['retry-after'];
        return new AzureDevOpsError(
          `Límite de tasa excedido. Reintenta después de ${retryAfter || 'unos segundos'}.`,
          statusCode,
          error,
          true
        );

      case 500:
      case 502:
      case 503:
      case 504:
        return new AzureDevOpsError(
          `Error del servidor de Azure DevOps (${statusCode}). El servicio puede estar temporalmente no disponible.`,
          statusCode,
          error,
          true
        );

      default:
        const message = data?.message || error.message || 'Error desconocido';
        return new AzureDevOpsError(
          `Error en ${context}: ${message} (código ${statusCode})`,
          statusCode,
          error,
          false
        );
    }
  } else if (error.request) {
    // Request fue enviado pero no hubo respuesta
    if (error.code === 'ECONNABORTED') {
      return new AzureDevOpsError(
        'La solicitud excedió el tiempo de espera. Verifica tu conexión a internet o aumenta el timeout.',
        null,
        error,
        true
      );
    }

    return new AzureDevOpsError(
      'No se pudo conectar con Azure DevOps. Verifica tu conexión a internet.',
      null,
      error,
      true
    );
  } else {
    // Error en la configuración de la solicitud
    return new AzureDevOpsError(
      `Error al configurar la solicitud: ${error.message}`,
      null,
      error,
      false
    );
  }
}

/**
 * Ejecuta una función con retry logic
 * @param {Function} fn - Función async a ejecutar
 * @param {Object} config - Configuración de reintentos
 * @param {string} context - Contexto para mensajes de error
 * @returns {Promise<any>} Resultado de la función
 */
async function withRetry(fn, config = DEFAULT_CONFIG, context = 'operación') {
  const {
    maxRetries,
    initialRetryDelay,
    maxRetryDelay,
    retryableStatusCodes,
  } = { ...DEFAULT_CONFIG, ...config };

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Si es el último intento, lanzar el error
      if (attempt === maxRetries) {
        break;
      }

      // Determinar si el error es reintentable
      const shouldRetry = error instanceof AzureDevOpsError
        ? error.isRetryable
        : isRetryableError(error, retryableStatusCodes);

      if (!shouldRetry) {
        throw error;
      }

      // Calcular delay y esperar
      const delay = calculateBackoff(attempt, initialRetryDelay, maxRetryDelay);
      console.warn(
        `[Azure DevOps] Intento ${attempt + 1}/${maxRetries} falló en ${context}. ` +
        `Reintentando en ${Math.round(delay)}ms...`
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Si llegamos aquí, todos los intentos fallaron
  throw lastError;
}

/**
 * Crea un cliente Axios listo para interactuar con la API de Azure DevOps
 * usando el token personal (PAT) proporcionado por el usuario.
 * @param {Object} params - Parámetros de autenticación.
 * @param {string} params.organization - Nombre de la organización en Azure DevOps.
 * @param {string} params.pat - Token personal con permisos suficientes.
 * @param {number} [params.timeout] - Timeout en milisegundos (opcional).
 * @returns {import('axios').AxiosInstance} Cliente Axios autenticado.
 */
function createAzureClient({ organization, pat, timeout = DEFAULT_CONFIG.timeout }) {
  if (!organization || !pat) {
    throw new AzureDevOpsError(
      'La configuración de Azure DevOps es incompleta. Asegúrate de definir organización y PAT.',
      null,
      null,
      false
    );
  }

  validatePAT(pat);

  const token = Buffer.from(`:${pat}`).toString('base64');

  return axios.create({
    baseURL: `https://dev.azure.com/${organization}`,
    headers: {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json',
    },
    timeout,
    validateStatus: (status) => status < 600, // No lanzar error automáticamente
  });
}

/**
 * Realiza una consulta WIQL para recuperar los work items asignados al usuario autenticado.
 * @param {Object} params - Parámetros requeridos para la consulta.
 * @param {string} params.organization - Organización de Azure DevOps.
 * @param {string} params.project - Proyecto de Azure DevOps.
 * @param {string | null} params.team - Equipo (opcional) para filtrar la consulta.
 * @param {string} params.pat - Token personal de Azure DevOps.
 * @param {number} [params.top=15] - Número máximo de elementos a recuperar.
 * @param {number} [params.timeout] - Timeout en milisegundos (opcional).
 * @param {number} [params.maxRetries] - Número máximo de reintentos (opcional).
 * @returns {Promise<Array>} Lista de work items simplificados.
 * @throws {AzureDevOpsError} Si ocurre un error durante la consulta.
 */
async function fetchAssignedWorkItems({
  organization,
  project,
  team = null,
  pat,
  top = 15,
  timeout,
  maxRetries,
}) {
  // Validar parámetros
  validateParameters({ organization, project, pat, top });

  const retryConfig = {
    ...DEFAULT_CONFIG,
    ...(timeout && { timeout }),
    ...(maxRetries !== undefined && { maxRetries }),
  };

  try {
    return await withRetry(
      async () => {
        const client = createAzureClient({ organization, pat, timeout: retryConfig.timeout });

        const wiqlPath = team
          ? `/${encodeURIComponent(project)}/${encodeURIComponent(team)}/_apis/wit/wiql?api-version=7.0`
          : `/${encodeURIComponent(project)}/_apis/wit/wiql?api-version=7.0`;

        const queryBody = {
          query: `SELECT [System.Id]
FROM WorkItems
WHERE [System.AssignedTo] = @Me
  AND [System.State] <> 'Closed'
ORDER BY [System.ChangedDate] DESC`,
        };

        // Ejecutar consulta WIQL
        const wiqlResponse = await client.post(wiqlPath, queryBody);

        if (wiqlResponse.status >= 400) {
          throw handleAxiosError(
            { response: wiqlResponse },
            'consulta WIQL'
          );
        }

        const workItems = wiqlResponse.data?.workItems || [];

        if (!workItems.length) {
          return [];
        }

        const ids = workItems.slice(0, top).map((item) => item.id).filter(Boolean);

        if (!ids.length) {
          return [];
        }

        // Obtener detalles de los work items
        const detailsResponse = await client.get('/_apis/wit/workitems', {
          params: {
            ids: ids.join(','),
            'api-version': '7.0',
          },
        });

        if (detailsResponse.status >= 400) {
          throw handleAxiosError(
            { response: detailsResponse },
            'obtención de detalles de work items'
          );
        }

        const items = detailsResponse.data?.value || [];

        return items.map((item) => {
          const assignedToField = item.fields?.['System.AssignedTo'];
          const assignedTo = typeof assignedToField === 'object'
            ? assignedToField?.displayName || assignedToField?.uniqueName
            : assignedToField || null;

          return {
            id: item.id,
            url: item.url,
            title: item.fields?.['System.Title'] || 'Sin título',
            workItemType: item.fields?.['System.WorkItemType'] || 'WorkItem',
            state: item.fields?.['System.State'] || 'Desconocido',
            assignedTo,
            areaPath: item.fields?.['System.AreaPath'] || null,
            iterationPath: item.fields?.['System.IterationPath'] || null,
          };
        });
      },
      retryConfig,
      'fetchAssignedWorkItems'
    );
  } catch (error) {
    // Si ya es un AzureDevOpsError, lanzarlo directamente
    if (error instanceof AzureDevOpsError) {
      throw error;
    }

    // Si es un error de Axios, convertirlo
    if (error.isAxiosError) {
      throw handleAxiosError(error, 'fetchAssignedWorkItems');
    }

    // Cualquier otro error
    throw new AzureDevOpsError(
      `Error inesperado al obtener work items: ${error.message}`,
      null,
      error,
      false
    );
  }
}

/**
 * Obtiene los Pull Requests de un repositorio en Azure DevOps
 */
async function fetchPullRequests({
  organization,
  project,
  repository,
  pat,
  status = 'active', // 'active', 'completed', 'abandoned', 'all'
  top = 20
}) {
  validateParameters({ organization, project, repository, pat, top });

  const client = createAzureClient({ organization, pat });
  
  const response = await client.get(
    `/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repository)}/pullrequests`,
    {
      params: {
        'api-version': '7.0',
        'searchCriteria.status': status,
        '$top': top
      }
    }
  );

  return response.data.value.map(pr => ({
    id: pr.pullRequestId,
    title: pr.title,
    status: pr.status,
    createdBy: pr.createdBy.displayName,
    creationDate: pr.creationDate,
    sourceRefName: pr.sourceRefName.replace('refs/heads/', ''),
    targetRefName: pr.targetRefName.replace('refs/heads/', ''),
    url: pr.url,
    description: pr.description
  }));
}

/**
 * Obtiene los detalles completos de un Pull Request incluyendo los archivos modificados
 */
async function fetchPullRequestDetails({
  organization,
  project,
  repository,
  pat,
  pullRequestId
}) {
  validateParameters({ organization, project, repository, pat });

  const client = createAzureClient({ organization, pat });
  
  // Obtener detalles básicos del PR
  const prResponse = await client.get(
    `/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repository)}/pullrequests/${pullRequestId}`,
    {
      params: {
        'api-version': '7.0'
      }
    }
  );

  const pr = prResponse.data;

  // Obtener la última iteración del PR
  const iterationsResponse = await client.get(
    `/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repository)}/pullrequests/${pullRequestId}/iterations`,
    {
      params: {
        'api-version': '7.0',
        '$top': 1,
        '$orderby': 'id desc'
      }
    }
  );

  const latestIteration = iterationsResponse.data.value[0];

  if (!latestIteration) {
    return {
      id: pr.pullRequestId,
      title: pr.title,
      status: pr.status,
      createdBy: pr.createdBy.displayName,
      creationDate: pr.creationDate,
      sourceRefName: pr.sourceRefName.replace('refs/heads/', ''),
      targetRefName: pr.targetRefName.replace('refs/heads/', ''),
      url: pr.url,
      description: pr.description,
      changedFiles: []
    };
  }

  // Obtener cambios de la iteración más reciente
  const changesResponse = await client.get(
    `/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repository)}/pullrequests/${pullRequestId}/iterations/${latestIteration.id}/changes`,
    {
      params: {
        'api-version': '7.0'
      }
    }
  );

  if (changesResponse.status >= 400) {
    throw handleAxiosError(
      { response: changesResponse },
      'obtención de cambios del PR'
    );
  }

  const changes = changesResponse.data?.changeEntries || changesResponse.data?.changes || [];
  
  // Filtrar solo archivos (no directorios) y mapear a la estructura deseada
  const changedFiles = changes
    .filter(change => {
      if (!change.item) return false;
      // Incluir si es un blob o si no tiene gitObjectType pero tiene path
      return change.item.gitObjectType === 'blob' || 
             (change.item.path && !change.item.isFolder);
    })
    .map(change => ({
      path: change.item.path,
      originalPath: change.originalPath || null,
      changeType: change.changeType,
      url: change.item.url
    }));

  return {
    id: pr.pullRequestId,
    title: pr.title,
    status: pr.status,
    createdBy: pr.createdBy.displayName,
    creationDate: pr.creationDate,
    sourceRefName: pr.sourceRefName.replace('refs/heads/', ''),
    targetRefName: pr.targetRefName.replace('refs/heads/', ''),
    url: pr.url,
    description: pr.description,
    changedFiles: changedFiles
  };
}

/**
 * Deduce el tipo de rama a partir del tipo de work item en Azure DevOps.
 * @param {Object} workItem - Work item con la propiedad workItemType.
 * @returns {string} Prefijo de rama sugerido.
 */
function inferBranchTypeFromWorkItem(workItem) {
  if (!workItem || typeof workItem !== 'object') {
    return 'feature';
  }

  const type = (workItem?.workItemType || '').toLowerCase();

  const mapping = {
    bug: 'bugfix',
    issue: 'bugfix',
    defect: 'bugfix',
    incident: 'hotfix',
    task: 'chore',
    'test task': 'test',
    'test case': 'test',
    feature: 'feature',
    epic: 'feature',
    story: 'feature',
    'user story': 'feature',
    'product backlog item': 'feature',
    chore: 'chore',
    documentation: 'docs',
    docs: 'docs',
    refactor: 'refactor',
  };

  return mapping[type] || 'feature';
}

module.exports = {
  fetchAssignedWorkItems,
  fetchPullRequests,
  fetchPullRequestDetails,
  inferBranchTypeFromWorkItem,
  AzureDevOpsError, // Exportar para uso en tests
};
