# M3 — Matriz REUSE / ADAPT / REPLACE

| Componente legacy | Decisión V3 | Motivo |
|---|---|---|
| Nombres reales de DB/colecciones CRM/Bandeja/Hunter | REUSE | Contratos observados directamente en código legacy. |
| Normalización flexible de deals/contactos | ADAPT | Buena tolerancia a variantes de campos; se mueve a normalizadores V3 aislados. |
| Vínculo deal ↔ conversation | ADAPT | Reutilizar estrategia de IDs, pero detrás de adapters V3. |
| Lectura `deals/{dealId}/notes` | REUSE/ADAPT | Útil como evidencia contextual; una nota genérica no se asume recontacto. |
| Métricas determinísticas de timestamps | ADAPT | Se implementan en Core V3 sin IA. |
| Cache de análisis/reviews | ADAPT | El patrón de no reprocesar es válido; V3 usa fingerprint/checkpoints propios. |
| Supervisor legacy como API intermedia | REPLACE | V3 debe leer fuentes directamente y ser independiente. |
| Reportes HTML/ZIP legacy | REPLACE/LATER | No pertenecen a Roadmap 1; Telegram/dashboard serán Roadmap 3. |
| Review IA legacy | ADAPT/LATER | Roadmap 2 decidirá qué lógica semántica reutilizar. |
| Colecciones Hunter y modelo de notas | REUSE | Son la fuente real confirmada de actividad Hunter. |
| UI Hunter | OUT OF SCOPE | Hunter sigue siendo fuente; V3 no reconstruye su UI en Roadmap 1. |
| `updatedAt` como prueba de recontacto | REPLACE | Puede representar cambios internos y generar falsos negativos. |
| Identidad vendedor por un solo string | REPLACE | V3 requiere directorio canónico multi-fuente con aliases. |
