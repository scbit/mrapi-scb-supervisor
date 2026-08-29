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
