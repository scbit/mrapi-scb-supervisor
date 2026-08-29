# SUPERVISOR SCB V3

Core de supervisión comercial para unificar señales determinísticas de:

- CRM
- Bandeja / WhatsApp
- Hunter

Este snapshot corresponde al avance manual de **Roadmap 1 — Core de Supervisión Comercial** mientras MRAPI DEV ORCHESTRATOR se encuentra en reparación.

## Qué hace

- normaliza conversaciones, mensajes, deals y contactos;
- resuelve identidad de vendedor entre fuentes;
- calcula clientes esperando respuesta humana;
- calcula tiempos de respuesta y demoras;
- agrega actividad por vendedor;
- incorpora gestiones Hunter;
- detecta fallas graves de seguimiento CRM;
- persiste estado derivado;
- procesa conversaciones incrementalmente con cursor + lookback + fingerprint;
- expone un endpoint para ejecutar el Core;
- incluye tests de reglas de negocio.

## No hace todavía

Roadmap 1 no implementa como experiencia final:

- Telegram;
- dashboard;
- IA avanzada de calidad comercial;
- radar avanzado de oportunidades;
- deploy automático.

## Ejecutar tests

```bash
npm install
npm test
```

## Ejecutar localmente

Con Application Default Credentials disponibles para los Firestore correspondientes:

```bash
npm start
```

Endpoints:

- `GET /`
- `GET /health`
- `POST /api/core/run`

Ejemplo:

```json
{
  "now": "2026-08-28T15:00:00-03:00"
}
```

## Bases por defecto

- Inbox/Bandeja: `bsscb`
- CRM: `bscrmscb`
- Hunter: `scb-hunter-bd`
- Estado derivado V3: por defecto la misma database configurada como Inbox, configurable con `SUPERVISOR_DATABASE_ID`.

## Importante

Antes de producción leer:

- `docs/MRAPI_HANDOFF.md`
- `docs/LEGACY_REUSE_MATRIX.md`
- `docs/PRODUCT_RULES_IMPLEMENTED.md`

No se accedió a producción ni se hizo deploy durante la creación de este snapshot.


## Snapshot 0.2.0
Adds legacy inspection evidence, executable source contracts, seller identity discovery, stricter CRM recontact evidence, and enriched Hunter activity.

## Snapshot 0.4.0

Acelera Roadmap 1 incorporando infraestructura incremental por fuente:

- checkpoints separados para Inbox, CRM y Hunter;
- lookback configurable por fuente con bootstrap acotado;
- deduplicación por fingerprint para conversations, deals y Hunter events;
- persistencia derivada de estado CRM/Hunter;
- cierre/reapertura correcta de alertas de follow-up mediante `active`;
- agregación Hunter reconstruida desde estado derivado del día, no desde scans históricos;
- resumen de ejecución con cursores y contadores por fuente.

Este bloque histórico preparó la consolidación de métricas integradas y agregación completa por vendedor implementada posteriormente.


## v0.4.0 Core consumption surfaces

- `GET /api/core/sellers?date=YYYY-MM-DD`
- `GET /api/core/waiting?date=YYYY-MM-DD`
- `GET /api/core/follow-up-failures`

The daily seller aggregation now rebuilds from persisted current-day derived state so incremental runs do not drop unchanged conversations from daily metrics.


## Snapshot 0.5.1 — Roadmap 1 release candidate

Hardening y cierre técnico del Core:

- validación estricta de configuración y límites de lectura;
- cálculo de vencimiento CRM respetando `America/Argentina/Buenos_Aires`;
- diagnósticos por corrida: conteos, límites alcanzados, skips y duración por fuente;
- `GET /api/core/status` con checkpoints y última corrida;
- protección fail-closed de todos los endpoints `/api/core/*` mediante `SUPERVISOR_API_TOKEN`;
- `SUPERVISOR_REQUIRE_AUTH=false` existe solamente para desarrollo controlado;
- validación de `now` / `forceSince` y límite máximo de backfill manual;
- tests de seguridad, configuración, timezone, diagnósticos e idempotencia lógica.

### Seguridad de endpoints Core

Por defecto `/api/core/*` queda bloqueado hasta configurar `SUPERVISOR_API_TOKEN`.
Enviar el token en:

```text
x-supervisor-token: <secret>
```

No guardar el token en el repositorio. En Cloud Run debe configurarse mediante Secret Manager o un mecanismo equivalente autorizado.

El endpoint `/` y `/health` permanecen públicos y no exponen conversaciones ni datos comerciales.


### Functional source validation
Protected read-only endpoint: `GET /api/core/validate-sources`. Requires the same Core API auth policy.


## Validación desde navegador

Abrir `/validate`, ingresar el TOKEN y presionar **Validar fuentes**. El navegador envía el token como header `x-supervisor-token`; no se persiste en el servidor.


## UI 0.5.3

`/validate` ahora funciona como panel del Core con botones para validar fuentes, ver estado, vendedores, clientes esperando, fallas CRM, contratos y ejecutar el Core sin escribir URLs manualmente.


## UI 0.5.4

La raíz `/` ahora muestra un index simple con botón directo a `/validate` y acceso a `/health`. El JSON de identidad del servicio queda disponible en `/api`.

## 0.5.5 — functional validation fixes

- CRM first bootstrap reads bounded real `deals`; incremental timestamp queries use Firestore Date first.
- Active CRM users are the canonical seller roster.
- Current waiting state survives midnight; daily activity remains daily.
- One-time migration indexes existing SUPERVISOR derived conversation states (not source history).
- Exact/short courtesy closings such as `Gracias` stop generating a waiting-client alert.
- Unassigned conversations are kept out of seller rankings and counted separately in run summary.

## 0.5.6 — bounded reads + CRM continuation

- Inbox remains incremental; historical 20k conversations are never full-scanned by this patch.
- CRM bootstrap is capped at 250 deal documents per run and continues from a persisted document-id checkpoint.
- CRM contact/notes enrichment happens only for severe follow-up candidates, reducing extra reads.
- Normal CRM incremental mode starts only after the bootstrap is complete.
- Unassigned current waits are remapped from derived state with a cap of 25 per run.
- Known technical/non-sales CRM accounts are excluded by exact configured email.
- Seller labels prefer the CRM user's name.
- Exact short courtesy endings include `Okey gracias`, `Bueno` and `Si si`.

## 0.5.7 — startup hotfix

- Fixes Cloud Run startup failure introduced in 0.5.6.
- `FieldPath` is now imported from `@google-cloud/firestore`, which is the Firestore package actually declared by this service.
- No business-rule or read-budget changes from 0.5.6.

## 0.5.8 — Pending assignment + ad origin

- `Nuevo / Sin asignar` is a valid operational queue, not an identity error.
- Supervisor never auto-assigns those chats.
- Derived state preserves first inbound customer message/time.
- Derived state preserves ad/source metadata when available: channel, origin, ad title, ad text, ad id, line.
- Added protected endpoint `/api/core/pending-assignment`.
- Pending-assignment chats stay outside seller rankings until a real owner/deal exists.
- Read budgets from 0.5.7 are unchanged.

## 0.5.10 — Real Meta Ad referral mapping

Mapped the actual Inbox conversation fields:
- referralSourceType -> sourceOrigin
- referralHeadline -> adTitle
- referralBody -> adText
- referralAdId -> adId
- requestedLineId -> adLine
- referralCtwaClid -> referralCtwaClid

No additional source scans were introduced. Existing read budgets remain unchanged.

## 0.5.11 — Bounded legacy pending-assignment backfill

- One-time checkpoint: `pending_assignment_backfill_v1`.
- Reads only current waiting states with sellerId `unknown`, maximum 100.
- For each exact conversation ID, performs one direct Inbox conversation-document read.
- No Inbox collection scan and no historical message scan.
- Reclassifies legacy states as pending-assignment/assigned using current source stage/owner/deal.
- Backfills real Meta Ad referral fields from the source conversation document.

## 0.5.12 — Conversation ID lookup fix

The pending-assignment backfill now resolves Inbox conversation IDs using the observed
with-plus / without-plus variants (e.g. `549...__549...` and `+549...__+549...`).
A fresh checkpoint `pending_assignment_backfill_v2` forces one bounded retry even if v1
completed without matching documents. The run summary reports `pendingAssignmentBackfillNotFound`.
No collection scan or historical message scan is added.

## 0.5.13 — assignmentState runtime hotfix

Fixes the Core runtime error `assignmentState is not defined` introduced by the
bounded pending-assignment backfill. `assignmentState` is now explicitly imported
from `conversationMetrics`. No business logic, read limits, checkpoints, or source
queries were changed.
