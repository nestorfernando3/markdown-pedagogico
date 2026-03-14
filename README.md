# Markdown Pedagógico

Editor de escritorio para escritura Markdown con **motor pedagógico basado en AST**, vista previa en vivo y exportación nativa a `.md` y `.pdf`.

Construido con **React 19 + Tauri v1 + TypeScript + Tailwind CSS v4**.

## Open Source de un vistazo

- **Licencia:** MIT
- **Estado:** mantenimiento activo
- **Tipo de proyecto:** editor de escritorio open source para escritura asistida y feedback pedagógico
- **Señales públicas:** suite de tests, chequeos de accesibilidad, quality gates en CI y documentación técnica
- **Cómo contribuir:** revisa [CONTRIBUTING.md](./CONTRIBUTING.md), [SUPPORT.md](./SUPPORT.md) y [SECURITY.md](./SECURITY.md)

## Características

### Motor Pedagógico en Tiempo Real

- Análisis AST del documento mientras se escribe (via unified/remark).
- Detección de **errores de sintaxis** Markdown con corrección automática (ej: `#Título` → `# Título`).
- Advertencias de **estructura**: jerarquía de encabezados rota, párrafos excesivamente largos ("muros de texto").
- Alertas de **pensamiento crítico**: afirmaciones absolutas, clichés retóricos.
- Sistema de **onboarding** para escritores principiantes.
- Overlay visual con indicadores por línea y tooltips contextuales con fix en un clic.

### Editor

- Vista dividida: escritura Markdown a la izquierda, renderizado HTML en vivo a la derecha.
- Barra de formato contextual (bold, italic, encabezado, lista) al seleccionar texto.
- `Training mode` adaptativo con coach flotante para aprender Markdown paso a paso.
- El coach de training usa las mismas señales derivadas del documento actual que alimentan preview y diagnóstico.
- Los ejemplos del training se insertan como snippets guiados y no reutilizan la selección previa del usuario.
- El paso de exportación del training sólo se completa tras una exportación PDF hecha con el training activo.
- **Modo Zen** para escritura sin distracciones.
- **Panel de referencia** para texto e imágenes de comparación.
- Autosave de borrador en `localStorage` con restauración automática.

### Exportación

- Guardar como `.md` vía comando nativo Rust.
- Exportar a **PDF multipágina con texto real** vía impresión HTML nativa en Tauri, con fallback rasterizado sólo en navegador.

## Requisitos

| Herramienta | Versión |
|-------------|---------|
| Node.js | `>=22 <23` |
| npm | `>=10` |
| Rust | Toolchain estable |
| Tauri CLI | Incluido como devDependency |

La versión de Node se valida automáticamente con `.nvmrc`, `engines` en `package.json` y un script `preinstall`.

## Setup

```bash
# Instalar Node 22 (si es necesario)
nvm install 22

# Activar versión correcta
nvm use

# Instalar dependencias
npm ci
```

### Sin nvm (Homebrew)

```bash
brew install node@22
export PATH="$(brew --prefix node@22)/bin:$PATH"
```

## Desarrollo

```bash
# Modo recomendado (sin hot-reload del backend Rust)
npm run tauri:dev

# Con hot-reload del backend Rust (útil si editas main.rs)
npm run tauri:dev:watch

# Solo frontend Vite (sin ventana nativa)
npm run dev
```

## Validación técnica

```bash
npm run check:node         # Validar versión de Node
npm run check:types        # Type-check TypeScript
npm run check:rust         # Compilación Rust (Tauri)
npm run check:a11y         # Auditoría automatizada axe-core del Editor
npm run check:tests        # Suite completa Vitest
npm run check:smoke:web    # Smoke rápido con Playwright CLI (requiere app corriendo)
npm run check:smoke:training  # Training mode + export PDF en navegador
npm run check:all          # Ejecuta todos los gates locales
npm run review:pdf -- /ruta/al/documento.pdf
```

### Quality Gates en CI

En cada `pull_request` y en pushes a `main`/`develop` corre el workflow:

- `.github/workflows/quality-gates.yml`
- Job `js-quality`: `npm ci`, `check:node`, `check:types`, `check:tests`.
- Job `tauri-rust-check`: `cargo check` en macOS.
- La auditoría `axe-core` corre dentro de `check:tests` y también se puede ejecutar de forma aislada con `check:a11y`.

## Arquitectura

```
src/
├── App.tsx                          # Root component
├── index.css                        # Tailwind config + animaciones
├── main.tsx                         # React entrypoint
├── components/Editor/
│   ├── Editor.tsx                   # Orquestador principal
│   ├── EditorWorkspace.tsx          # Shell UI editor + preview + tooltip
│   ├── Toolbar.tsx                  # Barra superior de acciones
│   ├── StatusBar.tsx                # Barra inferior de estado
│   ├── ReferencePanel.tsx           # Referencia textual/visual
│   ├── DiagnosticsPanel.tsx         # Panel de diagnóstico y métricas
│   ├── PedagogicalOverlay.tsx       # Markers y resaltado por severidad
│   └── TooltipContextual.tsx        # Tooltip de formato y pedagogía
├── hooks/
│   ├── useExportPdf.ts              # Exportación PDF desde Markdown fuente actual
│   ├── useFileOperations.ts         # Ciclo open/save/saveAs/isDirty
│   ├── useKeyboardShortcuts.ts      # Atajos globales del editor
│   ├── useTooltipState.ts           # Estado de tooltip
│   └── editor/
│       ├── useEditorDocument.ts     # Contenido, parse y métricas
│       ├── useWarningSession.ts     # Ignorar, nuevas, pico de warnings
│       └── useEditorInteractions.ts # Selección, formato y navegación
├── test/
│   ├── setup.ts                     # Setup Vitest
│   └── fixtures/
│       └── mediumMarkdown.ts        # Fixture documento mediano
└── utils/
    ├── markdownParser.ts            # Parse + render HTML sanitizado
    └── pedagogicalRules.ts          # Motor de reglas pedagógicas

src-tauri/
├── src/main.rs                      # Comandos Tauri (export_document, export_pdf_html, fallback bytes)
├── Cargo.toml                       # Dependencias Rust
└── tauri.conf.json                  # Config ventana, permisos FS, CSP
```

## Notas de estabilidad

- Autosave de borrador activo por defecto (debounce 180ms).
- Recuperación automática de borrador al reabrir la app.
- Overlay pedagógico virtualizado por warnings (no renderiza por cada línea del documento).
- Pipeline PDF genera HTML fresco desde el Markdown actual antes de exportar.
- Exportación nativa usa impresión HTML en Tauri; el modo rasterizado queda como compatibilidad web.
- El training comparte una única fuente de verdad con el editor para evitar desfases entre coach, preview y diagnóstico.
- La detección del primer párrafo del training se limita al cuerpo principal del documento, no a contenido anidado como citas.
- Benchmark automatizado del parser: `p95(parseMarkdown) < 400ms` en documento mediano.
- Gate automatizado de accesibilidad con `axe-core` sobre shell principal, paneles y tooltips del editor.
- Puerto Vite fijo (`5173`, `strictPort`) para evitar desincronización con Tauri.
- `transparent: false` en ventana para evitar pantalla invisible en macOS.

## Comunidad

- **Issues:** reportes de bugs, propuestas de mejora pedagógica y problemas de rendimiento son bienvenidos.
- **Pull requests:** mejoras en UX, reglas pedagógicas, testing, accesibilidad y exportación PDF tienen especial prioridad.
- **Preguntas de uso o adopción:** consulta [SUPPORT.md](./SUPPORT.md).
- **Seguridad:** reporta hallazgos de seguridad con discreción siguiendo [SECURITY.md](./SECURITY.md).

## Fixture de aceptación

- Fixture canónico para preview y PDF: [`src/test/fixtures/fullMarkdown.ts`](./src/test/fixtures/fullMarkdown.ts)
- Cubre TOC, referencias, footnotes, emoji shortcodes, KaTeX, Mermaid, código, admonitions y salto de página.

## QA con Skills

### Playwright

```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"

"$PWCLI" open http://localhost:5173 --headed
"$PWCLI" snapshot
```

O usar el wrapper del repo, que guarda log y snapshot reutilizable en `output/playwright/`:

```bash
npm run check:smoke:web
npm run check:smoke:training
```

Usar esta rutina para smoke tests de edición larga, export inmediata, preview, training mode y alternancia entre `legacy` y `CodeMirror`.

### PDF

```bash
npm run review:pdf -- /ruta/al/documento.pdf
```

El script extrae texto y renderiza páginas PNG en `tmp/pdfs/` para validar que el PDF no quedó rasterizado y que el documento completo llegó a exportación.

## Licencia

[MIT](./LICENSE)
