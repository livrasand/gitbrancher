const axios = require('axios');

/**
 * Crea un cliente Axios listo para interactuar con la API de Azure DevOps
 * usando el token personal (PAT) proporcionado por el usuario.
 * @param {Object} params - Parámetros de autenticación.
 * @param {string} params.organization - Nombre de la organización en Azure DevOps.
 * @param {string} params.pat - Token personal con permisos suficientes.
 * @returns {import('axios').AxiosInstance} Cliente Axios autenticado.
 */
function createAzureClient({ organization, pat }) {
  if (!organization || !pat) {
    throw new Error('La configuración de Azure DevOps es incompleta. Asegúrate de definir organización y PAT.');
  }

  const token = Buffer.from(`:${pat}`).toString('base64');

  return axios.create({
    baseURL: `https://dev.azure.com/${organization}`,
    headers: {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json',
    },
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
 * @returns {Promise<Array>} Lista de work items simplificados.
 */
async function fetchAssignedWorkItems({ organization, project, team = null, pat, top = 15 }) {
  if (!organization || !project || !pat) {
    throw new Error('No es posible consultar Azure DevOps sin organización, proyecto y PAT.');
  }

  const client = createAzureClient({ organization, pat });

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

  const wiqlResponse = await client.post(wiqlPath, queryBody);
  const workItems = wiqlResponse.data?.workItems || [];

  if (!workItems.length) {
    return [];
  }

  const ids = workItems.slice(0, top).map((item) => item.id).filter(Boolean);

  if (!ids.length) {
    return [];
  }

  const detailsResponse = await client.get('/_apis/wit/workitems', {
    params: {
      ids: ids.join(','),
      'api-version': '7.0',
    },
  });

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
}

/**
 * Deduce el tipo de rama a partir del tipo de work item en Azure DevOps.
 * @param {Object} workItem - Work item con la propiedad workItemType.
 * @returns {string} Prefijo de rama sugerido.
 */
function inferBranchTypeFromWorkItem(workItem) {
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
  inferBranchTypeFromWorkItem,
};
