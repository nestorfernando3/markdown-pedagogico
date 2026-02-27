const BASE_PARAGRAPH =
  'La redacción académica exige claridad, secuencia lógica y evidencia verificable. Este apartado describe el contexto del problema, delimita el alcance de la propuesta y explica por qué la estructura del documento facilita la comprensión. También incorpora conectores para mantener continuidad entre ideas, reduce ambigüedades en términos técnicos y evita afirmaciones absolutas cuando no existen datos suficientes. El objetivo principal es comunicar decisiones de diseño con precisión y permitir que otra persona replique el análisis sin perder información crítica.';

const LIST_BLOCK = `- Definir objetivo pedagógico explícito para la sección.
- Presentar evidencia breve antes de la conclusión local.
- Cerrar con una transición clara hacia el siguiente apartado.`;

const sections = Array.from({ length: 10 }, (_, index) => {
  return `## Sección ${index + 1}\n\n${BASE_PARAGRAPH}\n\n${BASE_PARAGRAPH}\n\n${LIST_BLOCK}`;
});

export const MEDIUM_MARKDOWN = `# Documento de Prueba\n\n## Introducción\n\n${BASE_PARAGRAPH}\n\n${sections.join(
  '\n\n'
)}\n\n## Conclusión\n\nEste cierre resume hallazgos, limita afirmaciones y propone siguientes pasos con métricas observables.`;
