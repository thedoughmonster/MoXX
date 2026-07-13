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
- Organize deployable behavior by business capability under `services/`.
- Each service owns `AGENTS.md`, `README.md`, and one valid `service.json`.
- Each owned function has a README with `ELI5`, trigger, input, output, side
  effects, failure handling, and tests, plus one valid `function.json`.
- Do not add function-level agent files unless a unique local rule requires one.
- Keep `supabase/functions/<slug>/` as a thin deployment adapter only.
- Manifests own logical purpose; runtime and route are deployment metadata.
- Use a vendor prefix only when a function contract or behavior is vendor-specific.
- Name source-neutral decisions and workers for the MoMi capability they own.
- Generate `docs/service-catalog.md` from manifests; never edit it by hand.
- Each deployable service lives in `services/<service-key>/`.
- Never place two independently deployable services in the same directory.
- Keep adapter `index.ts` as registration only; behavior belongs to its service.
- Keep module behavior and tests independently understandable and deployable.
- Services may import declared public contracts, never another implementation.
- Do not create catch-all utility folders or generic shared packages.
- Extract shared code only for three stable consumers or a security-critical
  need, with an ADR, explicit owner, and tests.
- Require an ADR for a service, external host, shared package, schema ownership
  change, or cross-service contract.
- Keep one ordered Supabase migration history in this repository.
- Do not split migrations into a repository separate from the code they support.
- Never modify or delete a migration already present on `prod`.
- Begin every new migration with `-- service-owner: <service-key>`.
- Never deploy with `--prune`; retire hosted functions through an expiring
  manifest and explicit caller-verified removal.
- Automated remote migration apply is paused. Validate migration files in Git,
  then apply intentional schema changes manually through the Supabase plugin.
- Preserve complete source payloads. Do not omit source fields.
- Do not perform business decisions or delivery work in ingestion code.
- Treat the warehouse as the system of record for all source and business data.
- Acquire source data through inbound webhooks, files, warehouse loads, or a
  dedicated hydration adapter processing durable work.
- Only a dedicated hydration adapter may fetch business data from a source API.
- Hydration and re-hydration must be scheduled, idempotent, and warehouse-backed.
- Never fetch source data inside a report, request, decision, or delivery path.
- Store every hydration attempt and complete source response before exposure.
- Do not chain internal modules with HTTP or Edge Function-to-Edge Function calls
  except for the allowlisted worker and MoMi API path accepted by ADR `0004`.
- Coordinate internal work through durable warehouse records.
- A dedicated invoker may call the MoMi API only from durable post-hydration work.
- Source-neutral invokers resolve the exact owned reader contract and route from
  durable work and active registry configuration, never from vendor constants.
- Persist the full hydrated resource version before queuing MoMi API work.
- Expose downstream reads as explicitly named, versioned database views.
- Application and client code may read warehouse data only through the MoMi API.
- The MoMi API may read approved views, never raw source tables directly.
- Delivery adapters may send durable outcomes but may not fetch business data.
- Snapshot source-neutral presentation data before creating delivery work.
- Keep source GUIDs out of destination payloads when readable identities exist.
- Supabase trigger adapters may use `pg_net` only as constrained by ADR `0004`.
- Trigger adapters may send only work identity and its per-work capability token.
- Trigger adapters may never call source or destination APIs.
- Any other exception requires an accepted ADR and the user's explicit approval.
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
5. Run `npm run check -- --service <service-key>`.
6. Review the diff before applying or deploying.
7. Verify the hosted behavior with a controlled event.

Applied migrations are immutable. Add a new migration for later corrections.
