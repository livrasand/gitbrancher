const axios = require('axios');
const { SERVER_URL, getToken } = require('./auth');

/**
 * Cliente para AI API (usa el servidor)
 */
class aiAnalyzer {
  constructor() {
    // Ya no necesita API key local
  }

  /**
   * Realiza una petición al servidor para análisis AI
   */
  async makeServerRequest(type, data) {
    const token = getToken();
    if (!token) {
      throw new Error('Debes iniciar sesión para usar AI.');
    }

    try {
      const response = await axios.post(`${SERVER_URL}/api/ai/analyze`, {
        type,
        data
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.result;
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Sesión expirada. Ejecuta "gitbrancher login".');
      }
      throw new Error(error.response?.data?.error || 'Error en análisis AI');
    }
  }

  /**
   * Analiza un archivo modificado y explica los cambios
   */
  async analyzeFileChanges(filePath, diff) {
    return await this.makeServerRequest('file-changes', {
      filePath,
      diff
    });
  }

  /**
   * Analiza el impacto de un PR completo
   */
  async analyzePRImpact(prTitle, modifiedFiles, affectedFiles, edges) {
    return await this.makeServerRequest('pr-impact', {
      prTitle,
      modifiedFiles,
      affectedFiles,
      edges
    });
  }

  /**
   * Evalúa la calidad y simplicidad del código
   */
  async evaluateCodeQuality(filePath, diff) {
    return await this.makeServerRequest('code-quality', {
      filePath,
      diff
    });
  }

  /**
   * Sugiere mejoras para lograr lo mismo de forma más eficiente
   */
  async suggestImprovements(filePath, diff) {
    return await this.makeServerRequest('improvements', {
      filePath,
      diff
    });
  }
}

module.exports = aiAnalyzer;
