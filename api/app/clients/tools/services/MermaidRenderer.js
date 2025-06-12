const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { apiRoot } = require('../../../../config/paths');

class MermaidRenderer {
  constructor() {
    this.outputDir = path.join(apiRoot, 'uploads', 'mermaid');
    this.setupOutputDir();
  }

  async setupOutputDir() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
      console.log(
        `Directorio para diagramas Mermaid configurado en: ${path.resolve(this.outputDir)}`,
      );
    } catch (err) {
      console.error('Error al crear directorio para diagramas Mermaid:', err);
    }
  }

  generateFileName(code) {
    const hash = crypto.createHash('md5').update(code).digest('hex');
    return `diagram-${hash}.png`;
  }

  async renderDiagram(code) {
    const fileName = this.generateFileName(code);
    const outputPath = path.join(this.outputDir, fileName);

    try {
      await fs.access(outputPath);
      console.log('Diagrama encontrado en caché:', outputPath);
      return this.getResult(fileName);
    } catch (err) {}

    console.log('Usando Puppeteer para renderizar diagrama Mermaid...');
    try {
      return await this.renderDiagramWithPuppeteer(code, fileName, outputPath);
    } catch (puppeteerErr) {
      console.error('Error renderizando con Puppeteer:', puppeteerErr);
      throw new Error(
        `No se pudo renderizar el diagrama Mermaid. Asegúrate de que Puppeteer esté funcionando correctamente: ${puppeteerErr.message}`,
      );
    }
  }

  getResult(fileName) {
    const filePath = path.join(this.outputDir, fileName);
    const url = `/api/files/uploads/mermaid/${fileName}`;
    return { filePath, url };
  }

  async renderDiagramWithPuppeteer(code, fileName, outputPath) {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();

      await page.setViewport({
        width: 1200,
        height: 800,
        deviceScaleFactor: 1,
      });
      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
          <script>
            mermaid.initialize({
              startOnLoad: true,
              theme: 'default',
              securityLevel: 'loose'
            });
          </script>
          <style>
            body {
              background: white;
              margin: 0;
              padding: 20px;
              font-family: Arial, sans-serif;
            }
            .mermaid {
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .mermaid svg {
              max-width: 100%;
              height: auto;
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

      await page.waitForSelector('.mermaid svg');
      const svgElement = await page.$('.mermaid svg');
      const boundingBox = await svgElement.boundingBox();

      await page.screenshot({
        path: outputPath,
        clip: {
          x: Math.max(0, boundingBox.x - 10),
          y: Math.max(0, boundingBox.y - 10),
          width: boundingBox.width + 20,
          height: boundingBox.height + 20,
        },
        omitBackground: true,
      });

      console.log('Diagrama renderizado correctamente con Puppeteer:', outputPath);
      return this.getResult(fileName);
    } finally {
      await browser.close();
    }
  }
}

module.exports = new MermaidRenderer();
