const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const crypto = require('crypto');
// Importar apiRoot desde la configuración de rutas
const { apiRoot } = require('../../../../config/paths'); // Asegúrate que apiRoot se exporta desde paths.js

/**
 * Servicio para renderizar diagramas Mermaid localmente
 */
class MermaidRenderer {
  constructor() {
    // Guardar en LibreChat/api/uploads/mermaid/
    this.outputDir = path.join(apiRoot, 'uploads', 'mermaid');
    this.setupOutputDir();
  }

  /**
   * Crea el directorio de salida si no existe
   */
  async setupOutputDir() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
      // Loguear la ruta absoluta para confirmación
      console.log(
        `Directorio para diagramas Mermaid configurado en: ${path.resolve(this.outputDir)}`,
      );
    } catch (err) {
      console.error('Error al crear directorio para diagramas Mermaid:', err);
    }
  }

  /**
   * Genera un nombre de archivo único basado en el contenido del código
   * @param {string} code - Código Mermaid
   * @returns {string} - Nombre del archivo único
   */
  generateFileName(code) {
    const hash = crypto.createHash('md5').update(code).digest('hex');
    return `diagram-${hash}.png`;
  }

  /**
   * Renderiza un diagrama Mermaid a una imagen PNG
   * @param {string} code - Código Mermaid
   * @returns {Promise<{filePath: string, url: string}>} - Ruta del archivo y URL
   */
  async renderDiagram(code) {
    const fileName = this.generateFileName(code);
    const outputPath = path.join(this.outputDir, fileName);

    // Verificar si el archivo ya existe (cache)
    try {
      await fs.access(outputPath);
      console.log('Diagrama encontrado en caché:', outputPath);
      return this.getResult(fileName);
    } catch (err) {
      // El archivo no existe, continuar con la renderización
    }

    // Skip mermaid-cli since it's causing issues
    // Go directly to Puppeteer
    console.log('Usando Puppeteer directamente para renderizar...');
    try {
      return await this.renderDiagramWithPuppeteer(code, fileName, outputPath);
    } catch (puppeteerErr) {
      console.error('Error renderizando con Puppeteer:', puppeteerErr);

      try {
        // Método 3: Fallback a SVG simple
        console.log('Fallback a SVG simple...');
        // Cambiar a extensión SVG para renderización básica
        const svgFileName = fileName.replace('.png', '.svg');
        const svgOutputPath = path.join(this.outputDir, svgFileName);
        return await this.renderDiagramAsSVG(code, svgFileName, svgOutputPath);
      } catch (svgErr) {
        console.error('Error en todos los métodos de renderización:', svgErr);
        throw new Error(`No se pudo renderizar el diagrama: ${puppeteerErr.message}`);
      }
    }
  }

  /**
   * Renderiza usando mermaid-cli instalado
   * @param {string} code - Código Mermaid
   * @param {string} fileName - Nombre del archivo
   * @param {string} outputPath - Ruta de salida
   * @returns {Promise<{filePath: string, url: string}>} - Información del archivo
   */
  async renderWithMermaidCLI(code, fileName, outputPath) {
    // Crear un archivo temporal con el código Mermaid
    const tempInputFile = path.join(this.outputDir, `temp-${fileName}.mmd`);
    await fs.writeFile(tempInputFile, code);

    // Usar mermaid-cli para renderizar el diagrama (usando la versión global)
    const command = `mmdc -i "${tempInputFile}" -o "${outputPath}" -b transparent`;

    console.log('Ejecutando comando:', command);
    const { stdout, stderr } = await execAsync(command);

    if (stderr && !stderr.includes('Puppeteer')) {
      console.error('Error en la renderización:', stderr);
      throw new Error(`Error al renderizar diagrama: ${stderr}`);
    }

    // Eliminar el archivo temporal
    await fs.unlink(tempInputFile);

    console.log('Diagrama renderizado correctamente con mermaid-cli:', outputPath);
    return this.getResult(fileName);
  }

  /**
   * Renderiza un diagrama Mermaid como SVG básico
   * @param {string} code - Código Mermaid
   * @param {string} fileName - Nombre del archivo
   * @param {string} outputPath - Ruta de salida
   * @returns {Promise<{filePath: string, url: string}>} - Información del archivo
   */
  async renderDiagramAsSVG(code, fileName, outputPath) {
    // Escapar el código para evitar problemas con comillas
    const safeCode = code.replace(/"/g, '\\"');

    // Crear un archivo SVG con el contenido del diagrama
    const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml">
      <style>
        .message {
          font-family: Arial, sans-serif;
          font-size: 14px;
          padding: 20px;
          background-color: #f0f0f0;
          border: 1px solid #ccc;
          border-radius: 5px;
          color: #333;
        }
        .code {
          font-family: monospace;
          white-space: pre;
          background-color: #eee;
          padding: 10px;
          margin-top: 10px;
          border-radius: 3px;
          overflow: auto;
          max-height: 400px;
        }
      </style>
      <div class="message">
        <p>Diagrama Mermaid (representación básica):</p>
        <div class="code">${safeCode}</div>
      </div>
    </div>
  </foreignObject>
</svg>`;

    await fs.writeFile(outputPath, svgContent);
    console.log('Diagrama renderizado como SVG básico:', outputPath);
    return this.getResult(fileName.replace('.png', '.svg'));
  }

  /**
   * Devuelve la información del archivo renderizado
   * @param {string} fileName - Nombre del archivo
   * @returns {{filePath: string, url: string}} - Información del archivo
   */
  getResult(fileName) {
    const filePath = path.join(this.outputDir, fileName);
    // Nueva URL para coincidir con la estructura /api/files/
    const url = `/api/files/uploads/mermaid/${fileName}`;
    return { filePath, url };
  }

  /**
   * Método alternativo usando Puppeteer directamente
   * @param {string} code - Código Mermaid
   * @param {string} fileName - Nombre del archivo
   * @param {string} outputPath - Ruta de salida
   * @returns {Promise<{filePath: string, url: string}>} - Ruta del archivo y URL
   */
  async renderDiagramWithPuppeteer(code, fileName, outputPath) {
    // Importamos Puppeteer (ya está instalado como dependencia)
    const puppeteer = require('puppeteer');

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();

      // Configuramos el viewport para un tamaño adecuado
      await page.setViewport({
        width: 1200,
        height: 800,
        deviceScaleFactor: 2, // Para mayor calidad
      });

      // HTML con la biblioteca Mermaid (cargada desde CDN)
      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
          <script>
            mermaid.initialize({
              startOnLoad: true,
              theme: 'default',
              securityLevel: 'loose',
              fontFamily: 'arial, sans-serif'
            });
          </script>
          <style>
            body {
              background: white;
              margin: 0;
              padding: 20px;
              overflow: hidden;
            }
            .mermaid {
              display: flex;
              justify-content: center;
            }
          </style>
        </head>
        <body>
          <div class="mermaid">
${code}
          </div>
        </body>
        </html>
      `);

      // Esperar a que Mermaid renderice el diagrama
      await page.waitForSelector('.mermaid svg');

      // Ajustar el tamaño de la captura al contenido real
      const svgElement = await page.$('.mermaid svg');
      const boundingBox = await svgElement.boundingBox();

      // Capturar solo el diagrama con un pequeño margen
      await page.screenshot({
        path: outputPath,
        clip: {
          x: boundingBox.x - 10,
          y: boundingBox.y - 10,
          width: boundingBox.width + 20,
          height: boundingBox.height + 20,
        },
        omitBackground: true, // Fondo transparente
      });

      console.log('Diagrama renderizado correctamente con Puppeteer:', outputPath);
      return this.getResult(fileName);
    } finally {
      await browser.close();
    }
  }
}

module.exports = new MermaidRenderer();
