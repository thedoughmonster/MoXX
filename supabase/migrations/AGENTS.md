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
- Database functions, triggers, and views must not perform business network calls.
- Insert durable work before any worker is invoked.
- Only a migration named for a trigger adapter may use `pg_net` under ADR `0004`.
- Adapter URLs must be exact configured MoMi Edge Function routes.
- Adapter bodies may contain only work identity and its capability token.
- Adapters must not call Toast, Slack, or another source or destination API.
