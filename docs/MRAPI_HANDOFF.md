# MRAPI DEV continuation handoff — SUPERVISOR SCB V3

## Why this file exists

Development was temporarily advanced manually while MRAPI DEV ORCHESTRATOR recovery/UI behavior was being repaired.
This repository remains the product repository and should later be inspected by MRAPI DEV rather than rebuilt from scratch.

## Trusted product runtime

- Product: SUPERVISOR SCB V3
- Workspace: `workspace_scb`
- MRAPI Project ID: `project_supervisor_scb_59e82cac`
- GitHub: `scbit/mrapi-scb-supervisor`
- Local path: `C:/Users/Shadow/Documents/GitHub/mrapi-scb-supervisor`
- Default branch: `main`
- Planned Cloud Run: `mrapi-scb-supervisor`

## Roadmap provenance

- Roadmap: `ROADMAP 1 — CORE DE SUPERVISIÓN COMERCIAL`
- Roadmap ID: `nFg3JnXtuzgKOn0Fvkz4`
- Planner Mission ID: `BS6i8W39SqRjo9hQJ6P4`
- Planner Brain Run ID: `bnxuKcGGwcmTbsrt3rnK`
- Proposal origin: `PLANNER_BRAIN_RUN`

Known UI state before manual continuation:
- Roadmap APPROVED.
- m1 was shown as COMPLETED in the Roadmap UI.
- A prior m1 Execution Run had encountered Git `dubious ownership` under the Codex sandbox; that is an Orchestrator concern and must not be fixed in this product repository.
- Manual implementation began while the Orchestrator was being repaired.

## Manual implementation scope represented by this snapshot

This snapshot advances Roadmap 1 foundations:
- legacy source inspection;
- REUSE / ADAPT / REPLACE record;
- explicit data contracts/normalizers;
- normalized seller identity resolver;
- Inbox/Bandeja incremental adapter;
- deterministic response/waiting metrics;
- CRM deal/contact adapter;
- severe follow-up rule;
- Hunter management activity integration;
- derived Supervisor persistence;
- per-seller daily aggregation;
- incremental cursor + lookback + fingerprint strategy;
- Cloud Run runnable entrypoint and Dockerfile;
- unit tests for critical business rules.

## What MRAPI should do when reconnected

1. Inspect the actual repository state before designing changes.
2. Treat this code as candidate existing implementation, not as trusted-complete work.
3. Run tests and verify behavior.
4. Re-inspect legacy sources if supplied to the Mission.
5. Classify/confirm REUSE / ADAPT / REPLACE.
6. Compare this repository against Roadmap 1 milestone success criteria.
7. Persist trusted evidence in the existing Roadmap/Missions.
8. Continue only missing milestones/work; do not recreate completed code without reason.
9. If a manual change invalidates downstream milestones, report DOWNSTREAM IMPACT before revising them.
10. Do not modify `mrapi-dev-orchestrator` from this product project.

## Manual snapshot limitations

- No production data was read.
- No GCP resources, credentials, Secrets, IAM or indexes were created.
- No deploy was performed.
- Seller aliases are intentionally empty until real identifiers are confirmed.
- The recontact rule uses known legacy date aliases; real current CRM semantics must be validated.
- Incremental Inbox query assumes `conversations.lastMessageAt` is indexable and representative of modifications.
- First run defaults to only the preceding 24 hours to avoid an uncontrolled historical scan. A deliberate bootstrap/backfill Mission should be designed if history is required.

## Recommended MRAPI evidence on reconnection

- git SHA of the manually uploaded snapshot;
- `npm ci` result;
- `npm test` result;
- runtime/remote/branch validation;
- controlled fixture tests;
- read-only schema samples from each source if authorized;
- confirmation of Firestore indexes;
- confirmation of seller mapping;
- incremental rerun proving unchanged conversations are skipped.
