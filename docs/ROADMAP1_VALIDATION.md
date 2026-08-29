# Roadmap 1 — Validation status at manual snapshot 0.5.0

## Implemented

- Canonical seller identity across CRM, Inbox and Hunter.
- Deterministic Inbox/WhatsApp response metrics.
- Waiting customer detection and waiting duration.
- CRM overdue deal normalization and severe follow-up rule.
- Severe rule excludes inactive stages and requires explicit post-due recontact evidence.
- Hunter activity aggregation by seller.
- Incremental checkpoints per source with lookback and fingerprints.
- Persisted derived conversation, deal, Hunter event and seller-day state.
- Daily aggregation rebuilt from persisted current-day state.
- Core consumption endpoints for sellers, waiting customers and follow-up failures.
- Operational diagnostics and saturation warnings.
- Fail-closed authentication for Core endpoints.
- Unit/integration-style tests for deterministic business rules and hardening helpers.

## Still requires MRAPI / controlled environment verification

This manual snapshot must NOT be marked Roadmap COMPLETE solely from local tests.
MRAPI DEV must inspect trusted Git state and execute/verify against authorized fixtures or controlled source data before completing milestones.

Required future evidence:

1. Runtime binding matches project_supervisor_scb_59e82cac / workspace_scb / scbit/mrapi-scb-supervisor / main.
2. Legacy REUSE/ADAPT/REPLACE findings are accepted or corrected from trusted evidence.
3. Firestore schemas match the adapters or adapters are adjusted in the same affected Mission.
4. Incremental run proves unchanged records are skipped and no recurrent full historical scan occurs.
5. Seller identity mapping is validated against real seller examples.
6. FALLA GRAVE is validated on known CRM deals.
7. Waiting/response metrics are validated on known Inbox conversations.
8. Hunter aggregation is validated on known Hunter activity.
9. Source limits do not saturate under normal operating volume; if they do, pagination must be added before COMPLETE.
10. Authentication/Secret configuration is performed as an explicit Human Action before exposing Core data endpoints operationally.

## Out of scope remains

Telegram, final dashboard, advanced AI quality analysis, advanced opportunity radar and automatic production deployment.
