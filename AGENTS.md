# MoMi Backend Agent Contract

## Ownership

This repository owns MoMi backend services, database migrations, and their
explicit contracts. Modules are separated by business capability even when
they deploy from the same repository.

- Ingest modules authenticate sources and preserve complete source records.
- Decision modules create durable outcomes from configured rules and mappings.
- Delivery modules format, send, and track notifications.
- Frontend and mobile applications belong in their own repositories.

## Hard Rules

- Do not require Docker or WSL for the normal development workflow.
- Keep every handwritten file at or below 120 physical lines.
- Each TypeScript file may declare at most one function.
- Each callable Edge Function lives in its own directory.
- Each non-Edge deployable service lives in `services/<service-name>/`.
- Never place two independently deployable services in the same directory.
- Keep `index.ts` as wiring only; behavior belongs in imported files.
- Keep module behavior and tests independently understandable and deployable.
- Keep one ordered Supabase migration history in this repository.
- Do not split migrations into a repository separate from the code they support.
- Preserve complete source payloads. Do not omit source fields.
- Do not perform business decisions or delivery work in ingestion code.
- Treat the warehouse as the system of record for all source and business data.
- Acquire source data through inbound webhooks, files, warehouse loads, or a
  dedicated hydration adapter processing durable work.
- Only a dedicated hydration adapter may fetch business data from a source API.
- Hydration and re-hydration must be scheduled, idempotent, and warehouse-backed.
- Never fetch source data inside a report, request, decision, or delivery path.
- Store every hydration attempt and complete source response before exposure.
- Do not chain internal modules with HTTP or Edge Function-to-Edge Function calls.
- Coordinate internal work through durable warehouse records.
- A dedicated invoker may call the MoMi API only from durable post-hydration work.
- Persist the full hydrated snapshot before queuing a MoMi API invocation.
- Expose downstream reads as explicitly named, versioned database views.
- Application and client code may read warehouse data only through the MoMi API.
- The MoMi API may read approved views, never raw source tables directly.
- Delivery adapters may send durable outcomes but may not fetch business data.
- Any exception requires an accepted ADR and the user's explicit approval.
- Put configurable business mappings in database tables, never code constants.
- Protocol constants may be coded only when an external contract requires them.
- Keep Toast-owned records in the `toast_raw` database schema.
- Keep downstream state in explicitly owned non-raw schemas.
- Do not create cross-source foreign keys in raw schemas.
- Do not add relationship columns solely to make joins easier.
- Build joins and projections as explicitly named, versioned database views.
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
