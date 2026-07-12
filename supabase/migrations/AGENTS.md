# Migration Rules

- Create migration files with `supabase migration new`; never invent timestamps.
- Applied migrations are immutable.
- One data source owns one raw schema; Toast owns `toast_raw`.
- Raw schemas contain source-preserving records and ingestion metadata only.
- Do not create cross-source foreign keys.
- Do not add convenience relationship columns for future joins.
- Use views for later projections and joins.
- Use identity primary keys for local ingestion records.
- Enforce source event idempotency with a unique source identifier.
- Use `timestamptz` for receipt times and `jsonb` for source documents.
- Revoke public, anonymous, and authenticated access to raw schemas.
- Enable RLS as defense in depth even when a raw schema is not exposed.
