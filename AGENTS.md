## Design Context

### Users
- Personas que están aprendiendo Markdown y necesitan escribir mientras reciben guía paso a paso.
- Usuarios pedagógicos o técnicos que quieren convertir ideas en documentos claros sin sentirse dentro de un IDE hostil.
- El trabajo principal es crear un documento legible, estructurado y exportable sin perder contexto entre escribir, previsualizar y corregir.

### Brand Personality
- Clara, calmada, técnica.
- La interfaz debe transmitir acompañamiento, control y progreso visible.
- El tono debe enseñar sin regañar y sugerir sin bloquear.

### Aesthetic Direction
- Mantener la dirección actual: vidrio suave, bordes redondeados, acento índigo y tipografía de sistema.
- Soportar light y dark mode sin introducir un lenguaje visual separado para el training mode.
- Evitar estética de IDE denso, dashboards rígidos o tutoriales caricaturescos y ruidosos.

### Design Principles
- Enseñar haciendo: cada paso debe mover el documento real, no una simulación aparte.
- No interrumpir la escritura: el coach debe acompañar, no secuestrar foco, selección o scroll.
- Progreso visible y concreto: cada paso debe tener objetivo y criterio de éxito explícitos.
- Una sola fuente de verdad: escribir, previsualizar, diagnosticar y exportar deben salir del mismo contenido actual.
- Paridad entre motores: cualquier experiencia nueva debe funcionar igual en el editor clásico y en CodeMirror.
