# MoMi Backend

Source-controlled backend services and database history for MoMi.

## Current Services

Five boundaries make Toast replaceable:

- `toast-webhook-ingestion` authenticates and permanently stores Toast events.
- `toast-data-acquisition` is the only active outbound Toast data caller.
- `momi-event-routing` delivers reference-only events through durable queues.
- `warehouse-projection` builds Dough Monster entities and source crosswalks.
- `warehouse-read-api` serves versioned, source-neutral `momi.*` contracts.

Orders, payments, menu entities, employees, schedules, stock observations, and
related history are projected into the private canonical warehouse. Business
services consume only `warehouse.*` events and the canonical reader. Inventory
interpretation is intentionally outside this repository boundary; a separate
service can consume canonical stock observations later.

The legacy Toast order reader and one-order hydration path remain only for a
measured alerting cutover. New collection and reconciliation work belongs to
the central acquisition service, and the legacy paths retire after they have no
consumers.

## Source Ownership

Exact webhook bodies and every acquisition request attempt, page, resource
version, and observation are retained in private `toast_raw.*` storage. Secrets
and authorization headers are never archived. Identical source content
deduplicates without discarding repeated observations.

Canonical entities use Dough Monster UUIDs. Source links map Toast, Square, or
another provider's identifiers to those stable entities, while provenance and
freshness remain available on canonical reads. Projections are rebuildable from
the archive with Toast unavailable.

## Module Boundaries

- Ingestion authenticates and preserves source records without source calls.
- Acquisition executes only registered read operations from durable work.
- Raw source payloads never become business-service contracts.
- Canonical readers expose stable Dough Monster documents and provenance.
- `source.toast.*` events are internal; consumers receive `warehouse.*` events.
- Queue delivery is at-least-once, leased, retried, and idempotent by event ID.
- Delivery owns Slack formatting, retries, and delivery status.
- Trigger adapters may wake allowlisted workers only from durable work using a
  per-work capability token.

## Repository Map

- `AGENTS.md`: non-negotiable engineering constraints.
- `docs/service-catalog.md`: generated capability and function inventory.
- `docs/`: shared architecture, decisions, and module contracts.
- `services/<service-key>/`: capability-owned code, contracts, tests, and docs.
- `supabase/migrations/`: reviewed database changes.
- `supabase/functions/<function-slug>/`: thin Edge Function deployment adapters.
- `packages/<package-name>/`: explicitly approved shared code only.
- `local-tools/`: private manual operator tooling that is never deployed.
- `schemas/`: machine-readable workspace and manifest contracts.
- `scripts/`: manifest-driven checks, inventory, and deployment orchestration.
- `tests/`: contract tests that require no local Supabase stack.

## Branches

- `dev` deploys to the persistent Supabase development branch.
- `prod` deploys to the production Supabase project.
- Production changes flow from reviewed and verified development changes.

See [deployment](docs/deployment.md) for the exact commands, credential
boundaries, inventory gate, and exact-commit promotion process.

After a change is committed on a clean feature branch, `pnpm release:dev`
handles its PR, checks, migration, and GitHub deployment. From clean, current
`dev`, `pnpm release:prod` performs the exact-commit production promotion.

## Hosted Secrets

Each Toast webhook subscription has its own signature secret. Toast client
credentials belong only to `toast-data-acquisition`. Destination credentials
belong only to their delivery adapters, and database URLs belong only to the
functions that declare them. Hosted values must never be committed.

## Verification

Run `pnpm check -- --service all` with Node.js 24. Archive verification also
requires a checksum-valid clean restore using the pinned PostgreSQL 17 tools.
