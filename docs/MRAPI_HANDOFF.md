# MRAPI DEV continuation handoff — manual snapshot 0.2.0

## Trusted product binding
- Project: SUPERVISOR SCB V3
- MRAPI Project ID: `project_supervisor_scb_59e82cac`
- Workspace: `workspace_scb`
- Repository: `scbit/mrapi-scb-supervisor`
- Local path: `C:/Users/Shadow/Documents/GitHub/mrapi-scb-supervisor`
- Branch: `main`
- Cloud Run: `mrapi-scb-supervisor`
- Roadmap ID: `nFg3JnXtuzgKOn0Fvkz4`
- Roadmap: ROADMAP 1 — CORE DE SUPERVISIÓN COMERCIAL

## Manual work performed while Orchestrator recovery was in progress

Snapshot `0.1.0` established a deployable Node 20 Core and was manually deployed successfully to Cloud Run.

Snapshot `0.2.0` advances Roadmap 1 manually with:
- M2 legacy inspection recorded from the user-provided Supervisor + Hunter ZIPs;
- M3 REUSE / ADAPT / REPLACE matrix;
- M4 executable source contracts;
- M5 partial seller identity discovery from CRM/Hunter users;
- correction of recontact evidence so generic `updatedAt` is NOT counted as customer recontact;
- Hunter activity enrichment for follow-ups/task events;
- additional tests.

## MRAPI reconciliation rule
When MRAPI DEV ORCHESTRATOR is healthy again:
1. inspect current Git repo before executing pending Roadmap milestones;
2. run tests and compare implementation/evidence against m2, m3, m4 and m5;
3. mark already-satisfied work based on trusted evidence instead of rebuilding it;
4. preserve Roadmap ID and milestone IDs;
5. do not modify `mrapi-dev-orchestrator` from this Product Project;
6. do not assume deploy permission.

## Known unresolved items
- Cross-source seller mapping still needs validation against real source users.
- Exact production field used for reliable CRM recontact must be verified with controlled data.
- No production data was accessed while creating this snapshot.

## Manual continuation — v0.3.0

While MRAPI DEV ORCHESTRATOR recovery/UI work is in progress, the Product Project advanced manually.
When orchestration resumes, MRAPI must inspect the repository rather than recreating these changes.

Implemented in v0.3.0:
- per-source checkpoints (`inbox`, `crm`, `hunter`) plus a core checkpoint summary;
- overlap/lookback and bounded bootstrap windows;
- conversation/deal/Hunter event fingerprints;
- derived deal state and Hunter event state;
- active/inactive follow-up failure persistence so resolved alerts can be closed;
- incremental CRM and Hunter adapter contracts;
- execution summaries exposing source cursors and skip counts.

Required MRAPI verification on resume:
1. validate runtime binding to this product repository;
2. inspect git state/current deployed version;
3. run the full local test suite;
4. validate real Firestore field/index compatibility before considering m6/m7 complete;
5. preserve Roadmap ID and milestone IDs; do not create a replacement Roadmap merely because manual work occurred.

## Manual snapshot 0.4.0

While MRAPI DEV ORCHESTRATOR recovery was in progress, Product Brain advanced Roadmap 1 manually.
Version 0.4.0 integrates the three operational surfaces into reusable daily seller metrics:

- Bandeja/WhatsApp deterministic response/waiting metrics.
- CRM severe follow-up failures.
- Hunter management + task-state activity.
- Full current-day aggregation from persisted derived state (not only the latest incremental batch).
- Read-only Core consumption endpoints `/api/core/sellers`, `/api/core/waiting`, `/api/core/follow-up-failures`.

When Orchestrator reconnects, inspect current repository state and execute tests before deciding milestone status.
Do not rebuild code that trusted evidence proves is already valid.


## Manual snapshot 0.5.0

Treat the repository as pre-existing implementation. Do not rebuild completed code by default.
First inspect Git state, run tests, compare implementation with Roadmap 1 milestones, and use trusted evidence to determine which milestones are already satisfied.

Important new hardening:
- Core endpoints fail closed unless SUPERVISOR_API_TOKEN is configured (or auth is explicitly disabled only for controlled development).
- Run diagnostics persist saturation warnings and timings.
- `/api/core/status` exposes checkpoints/latest run only behind Core auth.
- Roadmap 1 completion is intentionally NOT self-declared; see `docs/ROADMAP1_VALIDATION.md`.


## Manual snapshot 0.5.1
- Added read-only source validation endpoint `/api/core/validate-sources`.
- Confirmed source database defaults against supplied legacy code: bsscb / bscrmscb / scb-hunter-bd.
- Validation exposes only database IDs, reachability, collection names, sample existence and sample field keys; no document values.
- MRAPI must later persist trusted evidence from an authorized validation run before marking Roadmap 1 COMPLETE.
