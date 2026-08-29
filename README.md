# SUPERVISOR SCB V3 — 0.7.0

Realtime Supervisor + Telegram.

## Seguridad de datos
Las fuentes `bsscb`, `bscrmscb` y `scb-hunter-bd` son solo lectura. Toda escritura del producto va a `SUPERVISOR_DATABASE_ID`, que debe ser una BD distinta (prevista: `supervisor-scb`). El servicio falla al iniciar si falta esta variable o si coincide con una fuente.

## Variables
- `INBOX_DATABASE_ID=bsscb`
- `CRM_DATABASE_ID=bscrmscb`
- `HUNTER_DATABASE_ID=scb-hunter-bd`
- `SUPERVISOR_DATABASE_ID=supervisor-scb` (obligatoria)
- `SUPERVISOR_API_TOKEN` (secret)
- `TELEGRAM_BOT_TOKEN` (secret)
- `TELEGRAM_CHAT_ID`

## Endpoints
- `GET /health`
- `GET /api/core/validate-sources`
- `GET /api/core/status`
- `POST /api/core/run`
- `GET /api/supervisor/report`
- `POST /api/supervisor/report/send`

## CRM
La carga inicial crea un snapshot liviano de `deals` por páginas. No genera eventos históricos. Cuando termina, el CRM opera incrementalmente.

Seguimiento solo para: Seguimiento, Marca personal, Cotizado para enviar y Horno. Buckets: DUE, +15, +30, +60.

## Eventos
HORNO, GANADO, GANADO_FROM_AD. Se generan solo por transición posterior al snapshot inicial.

## Hunter
El KPI principal es GESTIONES: últimos 30 minutos y acumulado del día.

## Scheduler
No incluido todavía. El envío Telegram puede probarse manualmente con `/api/supervisor/report/send`.
