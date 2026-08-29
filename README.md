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

Este snapshot prepara el bloque siguiente (0.4.0), donde se consolidarán métricas integradas y agregación completa por vendedor.


## v0.4.0 Core consumption surfaces

- `GET /api/core/sellers?date=YYYY-MM-DD`
- `GET /api/core/waiting?date=YYYY-MM-DD`
- `GET /api/core/follow-up-failures`

The daily seller aggregation now rebuilds from persisted current-day derived state so incremental runs do not drop unchanged conversations from daily metrics.
