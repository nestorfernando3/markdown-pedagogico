# Contribuir a Markdown Pedagogico

Gracias por querer mejorar este editor.

## Areas donde una contribucion aporta mucho valor

- Reglas pedagogicas y heuristicas de escritura
- Accesibilidad del editor, overlays y tooltips
- Rendimiento del parser y del render en documentos medianos o largos
- Exportacion a PDF y operaciones de archivo
- Documentacion, onboarding y ejemplos de uso

## Antes de abrir un PR

1. Abre un issue si el cambio altera comportamiento o arquitectura.
2. Explica claramente el problema y el resultado esperado.
3. Mantén el cambio pequeño, testeable y enfocado.
4. Si tocas UI, incluye evidencia visual o notas de validacion.

## Setup local

```bash
nvm use
npm ci
npm run check:all
```

## Expectativas

- Mantener compatibilidad con Node 22 y Tauri v1.
- No degradar accesibilidad, rendimiento ni claridad de UX.
- Agregar o actualizar pruebas cuando cambie comportamiento observable.
