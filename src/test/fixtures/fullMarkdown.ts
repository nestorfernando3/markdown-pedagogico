export const FULL_MARKDOWN_ACCEPTANCE = `---
title: "Documento de prueba integral"
author: "Nestor"
date: "2026-03-01"
tags:
  - prueba
  - markdown
  - pdf
---

# Documento de prueba integral

## Contenido

[TOC]

## Introducción

Este documento valida **negrita**, *cursiva*, ~~tachado~~, <u>subrayado</u>, ==resaltado==, \`código inline\`, ^superíndice^, ~subíndice~ y <kbd>Cmd+S</kbd>.

También incluye una fórmula inline: $E = mc^2$.

Prueba de emoji: :sparkles:

Prueba de enlace directo: [OpenAI](https://openai.com)

Prueba de enlace por referencia: [Repositorio][repo]

Prueba de nota al pie[^1].

## Tipografía y texto

### Cita

> La claridad técnica no depende de adornos.
> Depende de estructura, contexto y precisión.

### Lista no ordenada

- Elemento uno
- Elemento dos
- Elemento tres con **énfasis**
- Elemento cuatro con \`inline code\`

### Lista ordenada

1. Primer paso
2. Segundo paso
3. Tercer paso

### Lista de tareas

- [ ] Tarea pendiente
- [x] Tarea completada
- [ ] Tarea con más detalle

### Lista de definición

Markdown

: Lenguaje de marcado ligero para escribir documentación.

PDF

: Formato de salida final para validar exportación.

## Admonitions

> [!NOTE]
> Esta es una nota de prueba para validar el estilo de admonition en preview y PDF.

> [!TIP]
> Usa este documento para detectar diferencias entre la vista previa y la exportación.

> [!WARNING]
> Si una sección se ve bien en pantalla pero mal en PDF, ahí hay un desfase de render.

## Tablas

| Campo | Valor | Observación |
| --- | --- | --- |
| Editor | Markdown Pedagógico | En prueba |
| Exportación | PDF | Validar saltos |
| Código | Shiki | Ver colores |
| Diagramas | Mermaid | Ver SVG |

## HTML inline y bloques enriquecidos

Texto con <u>subrayado HTML</u>, tecla <kbd>Esc</kbd> y un bloque expandible:

<details>
<summary>Mostrar contenido adicional</summary>

Aquí dentro hay texto oculto por defecto.

- Punto A
- Punto B
- Punto C

También una fórmula inline dentro de details: $a^2 + b^2 = c^2$

</details>

## Matemáticas

### Fórmula en bloque

$$
\\int_0^1 x^2 \\, dx = \\frac{1}{3}
$$

### Sistema simple

$$
\\begin{aligned}
x + y &= 10 \\\\
x - y &= 4
\\end{aligned}
$$

## Código

### TypeScript

\`\`\`ts
type User = {
  id: number;
  name: string;
  active: boolean;
};

const users: User[] = [
  { id: 1, name: 'Ana', active: true },
  { id: 2, name: 'Luis', active: false },
];

const activeUsers = users.filter((user) => user.active);
console.log(activeUsers);
\`\`\`

### Python

\`\`\`python
def fibonacci(n: int) -> list[int]:
    serie = [0, 1]
    while len(serie) < n:
        serie.append(serie[-1] + serie[-2])
    return serie[:n]

print(fibonacci(10))
\`\`\`

### JSON

\`\`\`json
{
  "name": "markdown-pedagogico",
  "export": "pdf",
  "features": ["gfm", "math", "mermaid", "shiki"]
}
\`\`\`

## Mermaid

\`\`\`mermaid
graph TD
  A[Escritura Markdown] --> B[Parser]
  B --> C[Vista previa]
  B --> D[Exportación PDF]
  C --> E[Validación visual]
  D --> F[Documento final]
\`\`\`

## Navegación y enlaces internos

Ir a [Resultados y conclusiones](#resultados-y-conclusiones).

Ir a [Código](#código).

---

<div style="page-break-after: always;"></div>

# Segunda página de prueba

## Resultados y conclusiones

Este cierre resume el comportamiento esperado del render.

[^1]: Esta es una nota al pie de prueba.

[repo]: https://github.com
`;
