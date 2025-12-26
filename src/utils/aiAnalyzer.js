const https = require('https');

/**
 * Cliente para AI API
 */
class aiAnalyzer {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.AI_API_KEY;
    this.baseUrl = 'api.deepseek.com';
    this.model = 'deepseek-chat';
  }

  /**
   * Realiza una petición a la API de la AI
   */
  async makeRequest(messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('AI no configurada. Define la AI_API_KEY en variables de entorno.');
    }

    const payload = JSON.stringify({
      model: this.model,
      messages: messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2000,
      stream: false
    });

    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: this.baseUrl,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.error) {
              reject(new Error(response.error.message || 'Error en API de AI'));
            } else {
              resolve(response.choices[0].message.content);
            }
          } catch (error) {
            reject(new Error(`Error al parsear respuesta: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Error de red: ${error.message}`));
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * Analiza un archivo modificado y explica los cambios
   */
  async analyzeFileChanges(filePath, diff, fileContent) {
    const messages = [
      {
        role: 'system',
        content: 'Eres un experto analista de código que explica cambios de forma clara y concisa. Responde en español.'
      },
      {
        role: 'user',
        content: `Analiza los siguientes cambios en el archivo "${filePath}":

\`\`\`diff
${diff}
\`\`\`

Proporciona un análisis breve que incluya:
1. **Resumen**: ¿Qué cambió? (1-2 líneas)
2. **Impacto**: ¿Qué efecto tiene este cambio?
3. **Calidad**: ¿Es simple y claro, o complejo?

Sé conciso y directo.`
      }
    ];

    return await this.makeRequest(messages, { maxTokens: 500 });
  }

  /**
   * Analiza el impacto de un PR completo
   */
  async analyzePRImpact(prTitle, modifiedFiles, affectedFiles, edges) {
    const filesList = modifiedFiles.map(f => `- ${f.path} (${f.status})`).join('\n');
    const affectedList = affectedFiles.slice(0, 5).join('\n- ');
    const hasMoreAffected = affectedFiles.length > 5;

    const messages = [
      {
        role: 'system',
        content: 'Eres un experto en arquitectura de software que analiza el impacto de cambios en código. Responde en español.'
      },
      {
        role: 'user',
        content: `Analiza el impacto del siguiente Pull Request:

**Título**: ${prTitle}

**Archivos Modificados** (${modifiedFiles.length}):
${filesList}

**Archivos Afectados** (${affectedFiles.length}):
- ${affectedList}${hasMoreAffected ? `\n... y ${affectedFiles.length - 5} más` : ''}

**Dependencias**: ${edges.length} conexiones entre archivos

Proporciona un análisis estructurado:

## [ANALYTICS] Alcance del Cambio
[Describe el alcance: ¿es un cambio localizado o amplio?]

## [TARGET] Áreas de Impacto
[Lista las áreas principales afectadas]

## [WARNING] Riesgos Potenciales
[Identifica posibles riesgos o efectos secundarios]

## [SUCCESS] Recomendaciones
[Sugiere qué revisar o probar con especial atención]

Sé conciso pero informativo.`
      }
    ];

    return await this.makeRequest(messages, { maxTokens: 1000 });
  }

  /**
   * Evalúa la calidad y simplicidad del código
   */
  async evaluateCodeQuality(filePath, diff) {
    const messages = [
      {
        role: 'system',
        content: 'Eres un revisor de código senior que evalúa calidad, simplicidad y mejores prácticas. Responde en español.'
      },
      {
        role: 'user',
        content: `Evalúa la calidad de los cambios en "${filePath}":

\`\`\`diff
${diff}
\`\`\`

Responde estas preguntas específicas:

1. **¿Es simple?**: ¿El código es fácil de entender?
2. **¿Es sencillo?**: ¿Usa el enfoque más directo?
3. **¿Repite código?**: ¿Hay duplicación o podría reutilizar código existente?
4. **¿Hay una mejor manera?**: ¿Sugieres alguna mejora?

Responde de forma directa y práctica.`
      }
    ];

    return await this.makeRequest(messages, { maxTokens: 600 });
  }

  /**
   * Sugiere mejoras para lograr lo mismo de forma más eficiente
   */
  async suggestImprovements(filePath, diff) {
    const messages = [
      {
        role: 'system',
        content: 'Eres un arquitecto de software que sugiere mejoras y alternativas más eficientes. Responde en español.'
      },
      {
        role: 'user',
        content: `Analiza estos cambios en "${filePath}" y sugiere mejoras:

\`\`\`diff
${diff}
\`\`\`

Proporciona:

## [ALTERNATIVE] Alternativas Mejores
[¿Hay una forma más simple o eficiente de lograr lo mismo?]

## [PATTERN] Patrones Recomendados
[¿Qué patrones de diseño o mejores prácticas aplicarían?]

## [OPTIMIZE] Optimizaciones
[¿Cómo mejorar el rendimiento o mantenibilidad?]

Sé específico y práctico.`
      }
    ];

    return await this.makeRequest(messages, { maxTokens: 800 });
  }

  /**
   * Analiza un nodo específico del grafo
   */
  async analyzeNode(nodeData, incomingNodes, outgoingNodes) {
    const incoming = incomingNodes.map(n => `- ${n.label} (línea ${n.line || 'N/A'})`).join('\n');
    const outgoing = outgoingNodes.map(n => `- ${n.label} (línea ${n.line || 'N/A'})`).join('\n');

    const messages = [
      {
        role: 'system',
        content: 'Eres un analista de dependencias que explica relaciones entre archivos. Responde en español.'
      },
      {
        role: 'user',
        content: `Analiza el archivo "${nodeData.label}" en el contexto del PR:

**Estado**: ${nodeData.modified ? 'Modificado' : 'Afectado'}
**Tipo de cambio**: ${nodeData.status || 'N/A'}

**Archivos que lo usan** (${incomingNodes.length}):
${incoming || 'Ninguno'}

**Archivos que usa** (${outgoingNodes.length}):
${outgoing || 'Ninguno'}

Explica brevemente:
1. **Rol**: ¿Qué función cumple este archivo en el sistema?
2. **Impacto**: ¿Por qué es importante revisar este archivo?
3. **Dependencias**: ¿Qué tan acoplado está con otros archivos?

Sé breve y claro.`
      }
    ];

    return await this.makeRequest(messages, { maxTokens: 400 });
  }
}

module.exports = aiAnalyzer;
