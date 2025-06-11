// Script para probar la generación local de diagramas Mermaid
const MermaidRenderer = require('./services/MermaidRenderer');
const SketchChain = require('./structured/SketchChain');

// Ejemplo de código Mermaid
const mermaidCode = `
graph TD
    A[Inicio] --> B{¿Renderizar localmente?}
    B -->|Sí| C[Generar imagen local]
    B -->|No| D[Usar servicio externo]
    C --> E[Guardar en servidor]
    D --> F[Obtener URL externa]
    E --> G[Mostrar en frontend]
    F --> G
`;

async function testMermaidRendering() {
  console.log('=== Test de renderización de diagramas Mermaid ===');
  console.log('Código Mermaid a renderizar:');
  console.log(mermaidCode);
  
  try {
    // 1. Test directo del renderizador
    console.log('\n1. Probando MermaidRenderer directamente:');
    const result = await MermaidRenderer.renderDiagram(mermaidCode);
    console.log('Resultado:', result);
    
    // 2. Test a través de SketchChain
    console.log('\n2. Probando SketchChain:');
    const sketchChain = new SketchChain();
    const response = await sketchChain._call({ prompt: mermaidCode });
    console.log('Respuesta de SketchChain:', response);
    
    console.log('\n✅ Prueba completada con éxito');
  } catch (error) {
    console.error('\n❌ Error en la prueba:', error);
  }
}

// Ejecutar el test
testMermaidRendering();
