const { z } = require('zod');
const base64url = require('base64url');
const { Tool } = require('@langchain/core/tools');
const MermaidRenderer = require('../services/MermaidRenderer');

class SketchChain extends Tool {
  constructor(fields = {}) {
    super();
    this.name = 'diagram-builder';
    this.description =
      'Convierte descripciones en texto en un diagrama Mermaid renderizado como imagen.';
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
      // Generar imagen localmente (esto sigue funcionando para guardar la imagen)
      const { url } = await MermaidRenderer.renderDiagram(code);
      console.log('🖼️ Mermaid Image URL (local):', url);

      // Pero usar la URL externa para mostrarla en el chat (esto funciona en el frontend)
      const payload = JSON.stringify({ code });
      const encoded = base64url(payload);
      const externalUrl = `https://mermaid.ink/img/${encoded}`;
      console.log('🖼️ Mermaid Image URL (external for display):', externalUrl);

      return `![Mermaid Diagram](${externalUrl})`;
    } catch (err) {
      console.error('Error renderizando diagrama:', err);
      // Si hay un error en la generación local, mostrar mensaje de error
      return `❌ Error en la generación de la imagen del diagrama: ${err.message}`;
    }
  }

  returnValue(value) {
    return this.isAgent ? [value, {}] : value;
  }
  async _call({ prompt }) {
    if (!prompt) {
      throw new Error('Falta el campo requerido: prompt');
    }
    const cleaned = prompt.trim();
    const mermaidCode = this.extractMermaidCode(cleaned) || cleaned;

    // Log del código que se va a usar para imagen
    console.log('\n📌 Código Mermaid recibido:');
    console.log(mermaidCode);
    try {
      const codeBlock = this.formatMermaidCode(mermaidCode);
      const imageBlock = await this.formatRenderedImage(mermaidCode);

      // Ya no se incluye el enlace de edición
      const result = `${codeBlock}\n\n${imageBlock}`;
      return this.returnValue(result);
    } catch (err) {
      return this.returnValue(`❌ Error generando el diagrama: ${err.message}`);
    }
  }
}

module.exports = SketchChain;
