import { MEDIUM_MARKDOWN } from './mediumMarkdown';

const SHORT_MARKDOWN = `# Resumen breve

Un ejemplo corto con [enlace](https://openai.com), \`código\`, :sparkles: y una lista.

- Punto uno
- Punto dos
`;

const RICH_MARKDOWN = `---
title: "Documento compacto"
author: "Nestor"
---

# Documento compacto

## Contenido

[TOC]

> [!NOTE]
> Esta muestra ejercita admonitions, tablas, matemáticas y bloques de código.

| Campo | Valor |
| --- | --- |
| Estado | Activo |
| Versión | 1.0 |

La fórmula inline $E = mc^2$ debe seguir renderizándose bien.

\`\`\`ts
const status = 'ready';
console.log(status);
\`\`\`

\`\`\`mermaid
graph TD
  A[Inicio] --> B[Proceso]
\`\`\`

<details>
<summary>Mostrar más</summary>

Texto adicional con ==resaltado== y <kbd>Cmd+S</kbd>.

</details>
`;

const LONG_MARKDOWN = `# Informe amplio

## Contexto

La redacción académica exige claridad, secuencia lógica y evidencia verificable. Este bloque extiende la muestra para que el benchmark cubra más texto continuo sin depender de un solo formato. También incorpora conectores para mantener continuidad entre ideas, reduce ambigüedades en términos técnicos y evita afirmaciones absolutas cuando no existen datos suficientes.

La idea es medir un documento largo pero todavía razonable, con varias secciones y una mezcla de párrafos, listas y cierre.

## Desarrollo

- Definir el objetivo de la sección.
- Presentar evidencia antes de la conclusión local.
- Cerrar con una transición clara hacia el siguiente apartado.

### Subtema

Este apartado repite una idea con variación suficiente para que el parser recorra más texto, pero sin inflar artificialmente la carga.

## Detalle adicional

La estructura debe seguir siendo legible incluso cuando el texto crece un poco más.

| Campo | Valor |
| --- | --- |
| Estado | En análisis |
| Objetivo | Estabilidad |

## Cierre

Este resumen final permite comprobar que los caminos de análisis y render siguen funcionando con un documento más amplio.
`;

export const MARKDOWN_BENCHMARK_FIXTURES = [
  {
    name: 'short',
    markdown: SHORT_MARKDOWN,
  },
  {
    name: 'medium',
    markdown: MEDIUM_MARKDOWN,
  },
  {
    name: 'rich',
    markdown: RICH_MARKDOWN,
  },
  {
    name: 'long',
    markdown: LONG_MARKDOWN,
  },
] as const;
