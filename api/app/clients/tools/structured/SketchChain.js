const { z } = require('zod');
const base64url = require('base64url');
const { Tool } = require('@langchain/core/tools');
const pako = require('pako');

class SketchChain extends Tool {
  constructor(fields = {}) {
    super();

    this.name = 'diagram-builder';
    this.description = 'Convierte descripciones en texto en un diagrama Mermaid renderizado como imagen.';
    this.description_for_model =
      'Convierte un prompt en código Mermaid. Devuelve el bloque Mermaid, la imagen renderizada y el link editable en MermaidChart.';
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

  formatRenderedImage(code) {
    const payload = JSON.stringify({ code });
    const encoded = base64url(payload);
    const url = `https://mermaid.ink/img/${encoded}`;
    console.log('🖼️ Mermaid Image URL:', url);
    return `![Mermaid Diagram](${url})`;
  }

  formatEditorLink(code) {
    const compressed = pako.deflate(code);
    const binaryString = Buffer.from(compressed).toString('base64');
    const base64urlSafe = binaryString
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const link = `https://www.mermaidchart.com/play#pako:${base64urlSafe}`;
    console.log('🔗 Mermaid Editor Link:', link);
    return `[Editar en MermaidChart](${link})`;
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

    // Log del código que se va a usar para imagen y editor
    console.log('\n📌 Código Mermaid recibido:');
    console.log(mermaidCode);

    try {
      const codeBlock = this.formatMermaidCode(mermaidCode);
      const imageBlock = this.formatRenderedImage(mermaidCode);
      const editorLink = this.formatEditorLink(mermaidCode);

      const result = `${codeBlock}\n\n${imageBlock}\n\n${editorLink}`;
      return this.returnValue(result);
    } catch (err) {
      return this.returnValue(`❌ Error generando el diagrama: ${err.message}`);
    }
  }
}

module.exports = SketchChain;
