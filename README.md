# SUPERVISOR SCB V3 — 0.7.3

Reporte ejecutivo con cartera vigente por vendedor.

## Regla de negocio: trato vigente
Incluye: SEGUIMIENTO, MARCA PERSONAL, PARA COTIZAR, COTIZADO PARA ENVIAR, HORNO, PENDIENTE DE PAGO.
Excluye NO RESPONDE y todos los estados cerrados/ganados/perdidos/descartados.

## Cambios
- Tratos vigentes totales y por vendedor.
- Bloque compacto por vendedor: vigentes, esperando, vencidos, Hunter y actividad.
- Esperas Bandeja en buckets <15, 15-29, 30-59 y 60+ min.
- Formato de tiempo humano para mayor espera.
- Roster unificado CRM/Hunter, excluyendo cuentas técnicas configuradas.
- Migración única de los deal states ya persistidos en supervisor-scb. No vuelve a leer el CRM completo.

No requiere variables nuevas. Fuentes siguen READ ONLY.


## v0.7.7 — Communications & Report Testing UI

Variables adicionales:
- `EMAIL_SERVICE_URL`
- `EMAIL_SYSTEM_TOKEN` (secret)
- `EMAIL_ACCOUNT_KEY`
- `SUPERVISOR_REPORT_EMAIL_TO`
- `SUPERVISOR_BUCKET_NAME=bucket-supervisor-orchestador`

La UI permite validar conectividad de mrapi-email, enviar pruebas de Email/Telegram, validar existencia del bucket sin escribir en él y separar Generar / Ver / Enviar reporte. El servicio de email se reutiliza vía `POST /api/system/send-email`; Supervisor no implementa SMTP.


## v0.7.8 — Email Report UX

- Mantiene `report.text` para Telegram.
- Genera `report.html` específico para email.
- HTML compatible con Outlook usando tablas y estilos inline.
- Secciones visuales separadas, métricas destacadas y tablas para cartera/atención.
- No cambia cálculos ni reglas de negocio del reporte general.


## v0.8.4 — Daily Report Accuracy + Actionable Email

- Corrige el porcentaje por vendedor para usar conversaciones de cliente respondidas, nunca cantidad de mensajes humanos sobre cantidad de clientes.
- Separa conversaciones respondidas, actividad humana y cantidad de mensajes humanos.
- Rediseña el email diario con tarjetas, ranking, calidad IA, cartera/Hunter/eventos y casos priorizados.
- Cada caso relevante incluye botón **Ver conversación** con `https://hub.sentirecustomsbroker.com/?conversationId=<conversationId>`.
- `HUB_BASE_URL` puede configurarse por entorno; usa el HUB productivo como valor por defecto.
- Fuentes operativas permanecen READ ONLY.
