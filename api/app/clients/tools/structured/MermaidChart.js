const { z } = require('zod');
const { Tool } = require('@langchain/core/tools');
const MermaidRenderer = require('../services/MermaidRenderer');

class MermaidChart extends Tool {
  constructor(fields = {}) {
    super();
    this.name = 'mermaid-builder';
    this.description =
      'Convierte descripciones de texto a diagramas Mermaid renderizados como imagen.';
    this.description_for_model =
      'Convierte un prompt en código Mermaid. Devuelve el bloque Mermaid y la imagen renderizada.';
    this.schema = z.object({
      prompt: z.string().max(4000),
    });

    this.isAgent = fields.isAgent ?? true;
  }

  extractMermaidCode(input) {
    const match = input.match(/```mermaid\s+([\s\S]+?)```/i);
    return match ? match[1].trim() : null;
  }
  formatMermaidCode(code) {
    return `\`\`\`mermaid\n${code}\n\`\`\``;
  }
  async formatRenderedImage(code) {
    try {
      const { url } = await MermaidRenderer.renderDiagram(code);
      console.log('🖼️ Mermaid Image URL (local):', url);

      const absoluteUrl = url.startsWith('http')
        ? url
        : `${process.env.HOST_URL || 'http://localhost:3080'}${url}`;
      console.log('🖼️ Mermaid Image URL (absolute):', absoluteUrl);

      return `![Mermaid Diagram](${absoluteUrl})`;
    } catch (err) {
      console.error('Error renderizando diagrama:', err);
      return `❌ Error en la generación de la imagen del diagrama: ${err.message}`;
    }
  }

  returnValue(value) {
    return this.isAgent ? [value, {}] : value;
  }

  async _call({ prompt }) {
    const cleaned = prompt.trim();

    if (!cleaned) {
      throw new Error('El prompt no puede estar vacío o solo contener espacios');
    }

    const mermaidCode = this.extractMermaidCode(cleaned) || cleaned;

    console.log('\n📌 Código Mermaid recibido:');
    console.log(mermaidCode);
    try {
      const codeBlock = this.formatMermaidCode(mermaidCode);
      const imageBlock = await this.formatRenderedImage(mermaidCode);
      const result = `${codeBlock}\n\n${imageBlock}`;
      return this.returnValue(result);
    } catch (err) {
      return this.returnValue(`❌ Error generando el diagrama: ${err.message}`);
    }
  }
}

module.exports = MermaidChart;
