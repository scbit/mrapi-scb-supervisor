# SUPERVISOR SCB V3 — 0.7.2

Hotfix de semántica operativa de Bandeja/Core sobre la base 0.7.1.

## Cambios

- `CUSTOMER_WAITING` usa primero la metadata operativa real de Bandeja/Core: `hasUnread`, `unreadCount`, `lastCustomerMessageAt`, `lastHumanMessageAt`, `lastMessageDirection` y `manualReadAt`.
- Un `manualReadAt` posterior al inbound cierra la espera.
- `Nuevo / Sin asignar` sigue la semántica de CORE: conversación sin `dealId`.
- Inbox incremental usa `updatedAt` como cursor primario para observar también manual-read, vínculo CRM y otros cambios que no alteran `lastMessageAt`.
- Migración única `conversation_unread_semantics_v072`: refresca solo los estados derivados que Supervisor ya tenía marcados como esperando, mediante lectura puntual del documento de conversación. No hace scan de Bandeja.
- El tiempo de espera se recalcula al momento del reporte para que siga avanzando sin releer mensajes.

## Seguridad

Fuentes `bsscb`, `bscrmscb` y `scb-hunter-bd`: READ ONLY. Única persistencia: `supervisor-scb`.

## Deploy

Descomprimir sobre el repo, correr `npm test`, commit y deploy manual. No requiere variables nuevas respecto de 0.7.1.
