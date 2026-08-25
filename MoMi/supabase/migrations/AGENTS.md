# Migration Rules

- Create migration files with `supabase migration new`; never invent timestamps.
- Applied migrations are immutable.
- Keep this directory flat. Only this `AGENTS.md` and migration SQL belong here.
- Put exactly one `-- service-owner: <service-key>` header on physical line 1
  of each migration not present in the production baseline; never rewrite
  legacy history to add one.
- After a migration lands on `dev`, correct it only with a new migration.
- A migration may mutate only its owner's relations, routines, and permissions.
- Index authority follows the exact indexed relation; unknown index mutations
  fail closed.
- Role membership, ownership transfer, and sequence DDL remain forbidden until
  those authorities have an explicit manifest model.
- An existing object transfer must land in a prior manifest-only change. The
  same change may not reassign and mutate the object because authority is read
  from the trusted development baseline.
- Trusted development history advances with each accepted `dev` SHA so a later
  ownership transfer cannot reinterpret already accepted migrations.
- Consumed public contracts permit reads or calls, never provider DDL or grants.
- Keep migration paths as regular, non-executable `.sql` files.
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
