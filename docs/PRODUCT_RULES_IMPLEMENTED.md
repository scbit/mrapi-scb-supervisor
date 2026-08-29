# Roadmap 1 business rules implemented in this snapshot

## Deterministic metrics
No AI is used for:
- seller activity;
- customer waiting;
- human responses;
- response time;
- late responses;
- Hunter management counts;
- severe CRM follow-up failures.

## Customer waiting
A customer is waiting when an inbound customer burst has not yet received a detected **human** outbound response.
Bot/automation output does not close the waiting period.

## Late response
Default: more than 15 minutes. Configurable in `config/supervisor.default.json`.

## Severe follow-up failure
All conditions must be true:
1. deal overdue by 7 days or more;
2. no recontact detected after due date;
3. stage is one of:
   - SEGUIMIENTO
   - MARCA PERSONAL
   - COTIZADO PARA ENVIAR
   - HORNO

`DESCARTADO` and `PERDIDO` do not alert.

## Seller identity
Resolution hierarchy for conversation ownership:
1. detected human message user;
2. conversation owner;
3. linked CRM deal owner;
4. linked CRM contact owner;
5. CRM contact found by phone;
6. derived `unknown`.

Configured aliases can unify CRM, Inbox and Hunter identities without code changes.

## Incremental strategy
- checkpoint stores latest processed source cursor;
- each run reads from cursor minus a configurable lookback window;
- each conversation gets a deterministic fingerprint;
- unchanged fingerprints reuse persisted metrics instead of recalculating;
- only derived state/references are persisted, not full source copies.

## Operating hours
Default Monday-Friday, 09:00-17:00 America/Argentina/Buenos_Aires.
Inactivity is exposed as state but is **not automatically treated as an alert**.
The 30-minute lunch allowance is retained in config for later supervisory policy rather than inventing a fixed lunch schedule.
