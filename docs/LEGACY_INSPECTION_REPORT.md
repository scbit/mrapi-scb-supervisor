# M2 — Inspección del Supervisor legacy y Hunter

Fecha de snapshot manual: 2026-08-28.

Este documento registra hallazgos obtenidos de los ZIP legacy entregados por el usuario. No hubo acceso a datos productivos.

## Supervisor legacy

Runtime confirmado:
- Node 20
- Functions Framework
- Firebase Admin / Firestore
- entrypoint `index.js`

Colecciones observadas en código:
- Bandeja: `conversations`, subcolección `messages`
- CRM: `deals`, `contacts`, `users`, `automation_configs`
- CRM deal notes: `deals/{dealId}/notes`
- Supervisor legacy: `supervisor_jobs`, `supervisor_reports`, `supervisor_reviews`

Patrones válidos encontrados:
- normalización tolerante de campos de deals/contactos;
- vínculo deal → conversation por `conversationId`, `dealId` o `contactId`;
- lectura de notas de un deal;
- filtros por owner/stage;
- cache/reutilización de reviews ya procesadas;
- separación entre datos determinísticos CRM y review IA.

Riesgo detectado:
- `updatedAt` / `lastActivityAt` no demuestran por sí solos que hubo recontacto al cliente. V3 no los utiliza como evidencia de recontacto.

## Hunter legacy

Runtime confirmado:
- Node 20.x
- Functions Framework
- `@google-cloud/firestore`
- entrypoint `index.js`
- database por defecto `scb-hunter-bd`

Colecciones confirmadas en código:
- `hunter_contact_sources`
- `hunter_customs_groups`
- `hunter_customs_items`
- `hunter_prospects`
- `hunter_notes`
- `hunter_tasks`
- `hunter_users`
- `hunter_upload_jobs`
- `hunter_upload_job_rows`
- `hunter_match_index`

Actividad comercial Hunter confirmada:
- las gestiones se registran en `hunter_notes`;
- campos observados: `prospectId`, `userId`, `userName`, `result`, `note`, `nextActionDate`, `taskType`, `isFollowUp`, `createdAt`;
- completar/reprogramar tareas también deja eventos en `hunter_notes`;
- asignación de vendedor vive en `commercial.assignedTo` / `commercial.assignedToName` dentro de prospectos.

## Conclusión M2

Existe suficiente lógica legacy para reutilizar conocimiento de esquema y normalización, pero V3 debe mantener sus adapters propios y no depender del Supervisor viejo como API.
