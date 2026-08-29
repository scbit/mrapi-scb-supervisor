# SUPERVISOR SCB V3 — Legacy inspection / REUSE · ADAPT · REPLACE

This document records the manual inspection performed while MRAPI DEV ORCHESTRATOR was being repaired.
It is intended to be revalidated by the formal MRAPI Roadmap 1 missions later.

## Sources inspected

### Supervisor legacy
Package: `supervisor-mensaje-ai`  
Version: `3.4.0-zip-reports`  
Runtime: Node 20  
Main file: `index.js`

Observed databases / collections:
- Inbox Firestore database: `bsscb`
- CRM Firestore database: `bscrmscb`
- `conversations`
- `conversations/{conversationId}/messages`
- CRM `deals`
- CRM `contacts`
- CRM `users`
- `supervisor_reports`
- `supervisor_jobs`
- `supervisor_reviews`
- `automation_configs`

### Hunter legacy
Package: `scb-hunter-campo`  
Version: `1.0.0`  
Runtime: Node 20.x  
Main file: `index.js`

Observed Firestore database:
- `scb-hunter-bd`

Observed collections:
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

## Matrix

| Capability | Decision | Reason |
|---|---|---|
| Message direction normalization | ADAPT | Legacy has broad aliases and actor detection that is useful. V3 keeps it in a pure module and distinguishes human from bot for response metrics. |
| Conversation normalization | ADAPT | Existing aliases are valuable, but V3 narrows the contract to deterministic Core fields. |
| CRM deal normalization | ADAPT | Legacy already handles stage/due-date aliases and closed-stage semantics. V3 centralizes it. |
| CRM contact normalization | ADAPT | Reuse field knowledge; move behind CRM adapter. |
| Seller resolution hierarchy | ADAPT | Legacy resolves human-message user → conversation owner → deal → contact → phone. V3 preserves the hierarchy but emits one normalized seller identity. |
| Response-time calculation | ADAPT | Legacy calculation is useful but used generic outbound in one QA path. V3 closes a waiting period only on detected human response, not bot. |
| Customer waiting detection | ADAPT | Preserve timestamps/messages; explicit human-only waiting semantics. |
| Daily seller aggregation | REPLACE | Legacy reporting is tightly mixed with rendering/AI. V3 stores deterministic aggregates as a reusable data product. |
| AI conversation review | REUSE LATER / OUT OF SCOPE | Proven logic exists but Roadmap 1 intentionally avoids AI for deterministic metrics. Revisit in Roadmap 2. |
| Supervisor report HTML/ZIP rendering | REUSE LATER / OUT OF SCOPE | Useful later for report experience, not part of Core. |
| Hunter management source (`hunter_notes`) | REUSE | This is the real source used by Hunter reports for seller management activity/result/timestamps. |
| Hunter users (`hunter_users`) | REUSE/ADAPT | Useful identity source; must map into V3 normalized seller identity. |
| Hunter tasks | REUSE LATER | Useful for follow-up context; Roadmap 1 initial metrics use managements/results. |
| Hunter prospect/import machinery | REPLACE AS DEPENDENCY | V3 should not duplicate Hunter nor depend on its UI/import logic. It only consumes the activity data needed for supervision. |
| Incremental Supervisor state | REPLACE | Legacy caching/report state is report-oriented. V3 introduces explicit fingerprints + checkpoints + derived conversation state. |
| Full historical rescans | REPLACE | Roadmap 1 requires bounded incremental reads after bootstrap. |
| Hard-coded mutable commercial thresholds | REPLACE | V3 centralizes business stages, thresholds and hours in configuration. |

## Important unresolved schema facts to validate with real data

The source code supports multiple historical field aliases. Before production:
- verify which conversation timestamp is consistently indexed (`lastMessageAt` expected);
- verify exact human message fields in current Bandeja traffic;
- verify the actual seller identifiers used across Inbox, CRM and Hunter;
- verify the exact CRM field representing a genuine recontact after due date;
- verify CRM deal volume is below the configured bounded read, or replace the bounded scan with a stage/due-date indexed query;
- confirm Firestore indexes needed by incremental queries;
- confirm the storage database chosen for V3 derived state.

No production data was accessed during this manual implementation.
