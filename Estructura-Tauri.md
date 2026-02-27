# Archivos Estructura del Proyecto (Tauri + React + TailwindCSS)

A continuación te presento la estructura de carpetas sugerida para cumplir con los lineamientos de separación de responsabilidades (UI vs Core de exportación) y prepararlo para Tauri.

```text
/
├── package.json
├── tailwind.config.js       # Configuración para el Liquid Glass y colores neutros
├── tsconfig.json
├── vite.config.ts
├── src/                     # FRONTEND (React)
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css            # Archivo base de TailwindCSS
│   ├── components/
│   │   ├── Editor/
│   │   │   ├── Editor.tsx   # Contenedor principal de edición y renderizado
│   │   │   └── TooltipContextual.tsx # UI Pedagógica (Liquid Glass Popup)
│   │   └── UI/              # Componentes genéricos (Botones, Modales, Headers)
│   ├── hooks/
│   │   └── useMarkdownAst.ts# Hook teórico para parseo AST de Markdown
│   ├── services/
│   │   ├── exportService.ts # Funciones asíncronas de exportación
│   │   └── fileSystem.ts    # Interacción con Tauri (Guardar/Abrir archivos)
│   ├── utils/
│   │   └── markdownParser.ts# Lógica pura de renderizado
│   └── assets/              # Iconos SVG neutros y fuentes
└── src-tauri/               # BACKEND (Rust / Binarios Nativos)
    ├── Cargo.toml
    ├── tauri.conf.json      # Configuración de compilación para Mac/Windows
    ├── src/
    │   └── main.rs          # Interfaz lógica para Pandoc o librerías de conversión a PDF/DOCX
    └── icons/
```

### Por qué esta estructura:
1. **Aislamiento (`services/` y `src-tauri/`)**: La lógica pesada de crear un PDF o un DOCX no debe vivir en React. Estas carpetas se conectarán vía Tauri IPC (`invoke()`), asegurando que el renderizado de la interfaz nunca se bloquee.
2. **Escalabilidad Pedagógica (`components/Editor/`)**: Separa la vista del editor de texto de la lógica reusada para los popups contextuales de onboarding.
