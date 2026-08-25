# Local Tooling

## ELI5

This is the locked cabinet for commands we run ourselves. The instructions may
live in both Git branches, but nothing here is installed in Supabase, exposed as
an endpoint, or started automatically.

## Locked Decisions

- Local tooling is tracked on both `dev` and `prod` to preserve exact promotion.
- Presence in the `prod` branch does not mean deployment to production.
- Local tooling is manual-only and must remain inaccessible over the network.
- GitHub Actions remains the sole authority for deploying repository services.
- A local data operation is not a deployment, but it must be explicit and audited.
- Secrets and production data never belong in this directory or Git history.
- Service-owned behavior stays with its service and is reused through a clear
  contract rather than copied into a command.

## Current Status

No local tools are implemented. In particular, there is no order backfill
command, hosted backfill function, schedule, or production endpoint.

## Future Order Backfill

If an initial Toast history backfill is approved later, it will be a Node 24
command run from a trusted workstation. It will use bounded date or page batches,
idempotent writes, checkpoints, resume support, a dry run, explicit production
confirmation, and a durable run record.

The future local backfill is separate from routine reconciliation. Routine
reconciliation may use a bounded Supabase Edge Function; the initial backfill
will never be deployed as one.
