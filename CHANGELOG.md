# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y este proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/).

## [Unreleased]

### Añadido

- Soporte extendido de Markdown en preview y exportación con tablas, task lists, footnotes, front matter, TOC, anchors y HTML enriquecido.
- Render de matemáticas con KaTeX y diagramas Mermaid en preview y exportación PDF.
- Resaltado de bloques de código con Shiki y tratamiento visual consistente entre vista previa y exportación.
- Diagnóstico editorial con `remark-lint` y ortografía offline con `nspell`, incluyendo sugerencias aplicables desde el editor.
- Modo de entrenamiento adaptativo con coach flotante, progreso persistente y ejemplos insertables para aprender Markdown paso a paso.
- Base opcional de CodeMirror 6 como motor alternativo del editor, manteniendo el editor clásico como default.
- Scripts operativos para smoke testing web con Playwright y revisión de PDF.

### Cambiado

- La exportación PDF usa el Markdown fuente actual como verdad única y genera HTML fresco justo antes de imprimir.
- La exportación nativa de Tauri prioriza impresión HTML a PDF con texto real y deja el fallback rasterizado sólo para navegador.
- El flujo de abrir, guardar y exportar ahora tiene fallback web coherente cuando la app no corre dentro de Tauri.
- La preview, la exportación y el diagnóstico comparten mejor el mismo estado actual del documento para evitar desfases.
- El tooltip pedagógico ahora puede aplicar correcciones seguras directamente para algunas reglas de `remark-lint`, como salto de línea final, espacios sobrantes al final de línea, listas y blockquotes.

### Corregido

- Corrección de truncamiento en exportaciones disparadas inmediatamente después de editar.
- Resolución correcta de referencias, footnotes y emoji en preview y exportación.
- Apertura segura de enlaces externos y navegación por anclas internas sin romper el shell de la app.
- Recuperación de foco, selección y formato contextual en el editor tras aplicar acciones rápidas.
- Mejoras de estabilidad en el menú contextual, accesibilidad del tooltip y persistencia del motor de edición.

## [1.0.0] - 2026-02-27

### Añadido

- **Editor Markdown** con vista dividida: escritura en texto plano + renderizado HTML en vivo.
- **Motor pedagógico basado en AST** (unified/remark) con análisis en tiempo real:
  - Detección de errores de sintaxis Markdown (`#Título` → `# Título`, `-Item` → `- Item`).
  - Advertencias de estructura: jerarquía de encabezados rota, párrafos excesivamente largos (>80 palabras).
  - Alertas de pensamiento crítico: afirmaciones absolutas (`siempre`, `nunca`, `todo`), clichés retóricos.
  - Advertencia global de densidad visual (>300 palabras sin énfasis).
  - Onboarding pedagógico para documentos nuevos.
- **Overlay pedagógico** con indicadores visuales por línea y scroll sincronizado.
- **Tooltip contextual** dual:
  - Modo formato: botones de negrita, cursiva, encabezado, lista con preview de sintaxis.
  - Modo pedagógico: mensaje de mejora + botón de corrección automática en un clic.
- **Modo Zen** para escritura sin distracciones (UI se oculta al no interactuar).
- **Panel de referencia** para cargar texto e imágenes de comparación.
- **Exportación a `.md`** vía comando nativo Rust (`export_document`).
- **Exportación a PDF** multipágina con tipografía estilizada (html2canvas + jsPDF → bytes escritos con Rust).
- **Autosave** de borrador en `localStorage` con debounce (180ms) y restauración automática al reabrir.
- **Dark mode** con soporte en todos los componentes (Tailwind `dark:` classes).

### Configurado

- Bloqueo de versión Node `>=22 <23` con validación en `preinstall`, `.nvmrc` y `engines`.
- Script de validación de versión (`scripts/check-node-version.mjs`) con guía nvm/Homebrew.
- Vite con `strictPort`, `usePolling` y `hmr.overlay: false` para estabilidad en desarrollo.
- Tauri v1 con `allowlist.fs.all = true`, scope `**` para acceso amplio al sistema de archivos.
- CSP de seguridad diferenciado entre desarrollo y producción.
- Workaround de compilación Rust (`pipelining = false`) en `.cargo/config.toml`.
- Ventana con `transparent: false` para evitar pantalla invisible en macOS.
- Fondo fallback en `body` y `#root` para renderizado antes de carga de Tailwind.

### Optimizado

- Debounce de parseo AST (220ms) para evitar sobrecarga en escritura rápida.
- Overlay pedagógico virtualizado: solo renderiza warnings activos, no una línea por cada línea del documento.
- Deduplicación y límite de warnings del parser (máx. 80 críticos).
- Pipeline PDF aísla estilos en DOM de export para evitar crash por funciones CSS no soportadas (`oklch`).
