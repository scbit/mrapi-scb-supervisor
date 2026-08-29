# Legacy runtime parity — v0.5.1

Verified from the supplied legacy source ZIPs (code inspection only):

## Supervisor legacy
- Inbox Firestore database default: `bsscb` (`FIRESTORE_DB` may override).
- CRM Firestore database: `bscrmscb`.
- Inbox collections observed: `conversations`, `users`, plus legacy supervisor/report collections.
- CRM collections observed: `deals`, `contacts`, `users`.
- Conversation messages live under `conversations/{conversationId}/messages`.

## Hunter legacy
- Firestore database default: `scb-hunter-bd` (`FIRESTORE_DATABASE_ID` may override in legacy).
- Collections observed: `hunter_prospects`, `hunter_notes`, `hunter_tasks`, `hunter_users`, `hunter_contact_sources`, `hunter_customs_groups`, `hunter_customs_items`, `hunter_upload_jobs`, `hunter_upload_job_rows`, `hunter_match_index`.

## V3 parity
V3 defaults already match the three source database IDs above:
- `INBOX_DATABASE_ID=bsscb`
- `CRM_DATABASE_ID=bscrmscb`
- `HUNTER_DATABASE_ID=scb-hunter-bd`

`GET /api/core/validate-sources` was added as a protected, read-only connectivity/schema-key check. It reads at most one document per checked collection and returns field names only, never field values. This is intended for controlled functional validation after Cloud Run has the required IAM/database access.

No production access, IAM changes, secrets, or deployment are performed by this snapshot.
