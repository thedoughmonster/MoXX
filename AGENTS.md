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
- Target 120 physical lines for handwritten non-SQL files; CI warns above 120 and fails above 140.
- Each TypeScript file may declare at most one function.
- Organize deployable behavior by business capability under `services/`.
- Each service owns `AGENTS.md`, `README.md`, and one valid `service.json`.
- Each owned function has a README with `ELI5`, trigger, input, output, side effects, failure handling, and tests, plus one valid `function.json`.
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
- Never dirty `dev`; all work happens on feature branches or feature worktrees.
- Follow ADR `0013` before adding services, datasets, source calls, transforms, subscriptions, public contracts, or permissions.
- Never add new findings to the constitution debt baseline; remove fixed entries.
- Never add or rewrite runtime access debt findings, including active view and routine bodies; remove only after owner-contract cutover.
- Every dataset has exactly one owning service; other services use only the owner's versioned public contracts.
- Procurement services may call external sources but may not call MoMi-owned services or write domain datasets.
- Dataset ownership includes database permissions; private tables must become
  inaccessible to non-owner runtime roles as enforcement hardens.
- Services may import declared public contracts, never another implementation.
- Do not create catch-all utility folders or generic shared packages.
- Extract shared code only for three stable consumers or a security-critical
  need, with an ADR, explicit owner, and tests.
- Require an ADR for a service, external host, shared package, schema ownership
  change, or cross-service contract.
- Keep one ordered Supabase migration history in this repository.
- Do not split migrations into a repository separate from the code they support.
- Never modify or delete a migration already present on `prod`.
- Keep `supabase/migrations/` flat; only `AGENTS.md` and migration SQL belong there.
- Start each migration absent from production with one `-- service-owner: <service-key>` header.
- Land an ownership transfer as a manifest-only change before any later migration mutates it; checks pin existing authority to trusted `dev`.
- Never deploy with `--prune`; retire hosted functions through an expiring manifest and explicit caller-verified removal.
- GitHub Actions is the sole authority for repository code and Edge Function deployments. Local apply, Supabase Git deployment, and second deployers are forbidden by ADR `0006`.
- Only `.github/workflows/deploy-dev.yml` and `deploy-prod.yml` may invoke the
  deployment apply command.
- The Node 24 release coordinator is the sole normal database migration
  authority. It must use the pinned Supabase CLI and IPv4 session pooler.
- A development deployment may start only after its exact commit is validated
  and its migrations have reached parity; migration-free features may inherit
  parity only from the exact deployed `dev` baseline and an empty migration diff.
- Keep manual operator programs under `local-tools/` and obey its `AGENTS.md`.
- Track local tooling on both branches, but never deploy, host, schedule, or
  import it into runtime code.
- Follow `docs/agent-deployment-procedure.md` for every hosted release. Do not
  improvise another publisher after an authentication or permission failure.
- The Supabase plugin may inspect or repair migration state in an emergency,
  but it is not a normal migration or repository deployment authority.
- Preserve complete source payloads. Do not omit source fields.
- Do not perform business decisions or delivery work in ingestion code.
- Treat the warehouse as the system of record for all source and business data.
- Acquire source data through inbound webhooks, files, warehouse loads, or a dedicated hydration adapter processing durable work.
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
- Store runtime secrets in Supabase, deployment secrets in GitHub, and local CLI credentials in the approved release host's credential store.
- Authenticate the pinned Supabase CLI by OAuth/PAT; supply its temporary token as `SUPABASE_DB_PASSWORD`, never the long-lived Postgres role password.
## Default Development Loop
- Use `$develop-repository-change` for ordinary features, fixes, and refactors.
- One owning agent inspects, implements, tests, and prepares the reviewable diff.
- Use focused tests while iterating, then run the required full check once.
- Keep mechanical enforcement in tests and CI; do not manually re-audit passes.
- Perform one final semantic review. Classify findings as `BLOCKING`, `FIX_NOW`, `FOLLOW_UP`, or `NO_ACTION`; only the first two normally trigger another edit.
- Escalate to Architect or Repo Guard only for a new ownership/contract boundary,
  material security/privacy/cost/exposure decision, destructive migration,
  production infrastructure change, or irreconcilable repository-law conflict.
- Use subagents only for independent parallel work that materially saves time.
- Release code-only work with `pnpm release:dev`, migrations with `/root/momi-release dev`, and promote with `/root/momi-release prod`.
- Verify hosted behavior with one controlled acceptance event. Applied migrations
  are immutable; add a new migration for later corrections.

## Code Review Rules
- Block unauthorized ownership, private-data, public-contract, or deployer changes.
- Block material correctness, security, privacy, data-loss, or rollback defects.
- Report nonblocking improvements as follow-up work; leave mechanical checks to CI.
