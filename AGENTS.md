# MoMi Toast Ingest Agent Contract

## Ownership

This repository owns receipt and source-preserving storage of Toast data.
It does not own Slack formatting, operational decisions, or cross-source views.

## Hard Rules

- Do not require Docker or WSL for the normal development workflow.
- Keep every handwritten file at or below 120 physical lines.
- Each TypeScript file may declare at most one function.
- Each callable Edge Function lives in its own directory.
- Keep `index.ts` as wiring only; behavior belongs in imported files.
- Preserve complete source payloads. Do not omit source fields.
- Do not perform business transformations in ingestion code.
- Put configurable business mappings in database tables, never code constants.
- Protocol constants may be coded only when an external contract requires them.
- Keep Toast-owned records in the `toast_raw` database schema.
- Do not create cross-source foreign keys in raw schemas.
- Do not add relationship columns solely to make joins easier.
- Build joins and projections as explicitly named database views later.
- Treat the Toast event GUID as the delivery idempotency key.
- Store secrets only in Supabase Edge Function Secrets or local ignored env files.

## Change Sequence

1. Update the behavior contract.
2. Add or revise tests.
3. Create a migration with the Supabase CLI when schema changes are needed.
4. Implement the smallest behavior change.
5. Run tests and line-count checks.
6. Review the diff before applying or deploying.
7. Verify the hosted behavior with a controlled event.

Applied migrations are immutable. Add a new migration for later corrections.
