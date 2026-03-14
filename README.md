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
- **Modo Zen** para escritura sin distracciones.
- **Panel de referencia** para texto e imágenes de comparación.
- Autosave de borrador en `localStorage` con restauración automática.

### Exportación

- Guardar como `.md` vía comando nativo Rust.
- Exportar a **PDF multipágina** con tipografía estilizada (html2canvas + jsPDF → bytes vía Rust).

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
npm run check:all          # Ejecuta todos los gates locales
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
│   ├── useExportPdf.ts              # Exportación PDF
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
├── src/main.rs                      # Comandos Tauri (export_document, export_pdf_bytes)
├── Cargo.toml                       # Dependencias Rust
└── tauri.conf.json                  # Config ventana, permisos FS, CSP
```

## Notas de estabilidad

- Autosave de borrador activo por defecto (debounce 180ms).
- Recuperación automática de borrador al reabrir la app.
- Overlay pedagógico virtualizado por warnings (no renderiza por cada línea del documento).
- Pipeline PDF aísla estilos para evitar fallos de parseo con `oklch` (Tailwind v4).
- Benchmark automatizado del parser: `p95(parseMarkdown) < 300ms` en documento mediano.
- Gate automatizado de accesibilidad con `axe-core` sobre shell principal, paneles y tooltips del editor.
- Puerto Vite fijo (`5173`, `strictPort`) para evitar desincronización con Tauri.
- `transparent: false` en ventana para evitar pantalla invisible en macOS.

## Comunidad

- **Issues:** reportes de bugs, propuestas de mejora pedagógica y problemas de rendimiento son bienvenidos.
- **Pull requests:** mejoras en UX, reglas pedagógicas, testing, accesibilidad y exportación PDF tienen especial prioridad.
- **Preguntas de uso o adopción:** consulta [SUPPORT.md](./SUPPORT.md).
- **Seguridad:** reporta hallazgos de seguridad con discreción siguiendo [SECURITY.md](./SECURITY.md).

## Licencia

[MIT](./LICENSE)
