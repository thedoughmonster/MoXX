# Deployment

GitHub Actions is the sole deployment authority for repository code and Edge
Functions. The Supabase GitHub deployment integration must remain disabled.
Local apply and any second deployment path are forbidden by ADR `0006`.
Agents must also follow `agent-deployment-procedure.md`.

## Commands

```text
npm run check -- --service <key|all>
npm run deploy:plan -- --env <dev|prod> --service <key|all>
npm run deploy:apply -- --env <dev|prod> --service <key|all>
npm run inventory -- --env <dev|prod>
```

The apply command is executable only by the matching push workflow on `dev` or
`prod`. It runs checks, deploys explicit manifest-owned functions with the
pinned CLI and `--use-api`, checks hosted inventory, probes functions, reads
Supabase advisors, and writes a release artifact. It never uses Docker,
`--prune`, or implicit function discovery.

## Credentials

The `dev` and `prod` GitHub environments each store a permanent
`SUPABASE_ACCESS_TOKEN` for Supabase API operations and Edge Function
deployment. Automatic deployments do not request a database password.

Automated remote migration planning and apply are paused. Migration files still
pass ownership, immutability, and architecture checks in GitHub. An intentional
schema change is applied manually with the Supabase plugin after review, then
verified against hosted migration history. Re-enabling automatic apply requires
a healthy non-IPv6 connection and a passing hosted deployment proof.

That temporary schema-administration path cannot deploy repository functions.

Temporary database access remains an independent administrator path and cannot
silently change deployment behavior.

Runtime credentials remain in Supabase and deployment credentials remain in
protected GitHub environments. Manifests contain names, never values.

## Branch Flow

Feature branches start from `dev`. A merge to `dev` validates and deploys that
exact commit to the development project. Production requires a ready open PR
from `dev` to `prod`. The repository owner dispatches the promotion with the
exact approved `dev` SHA, and the workflow fast-forwards `prod` only when the
PR head, input, and current `dev` commit all match.

## Hosted Controls

GitHub environments restrict `dev` deployments to `dev`, `prod` deployments
to `prod`, and `prod-promotion` runs to `dev`. Supabase's repository deployment
integration is disabled. Do not reconnect it or Git-sync a Supabase branch.

GitHub does not enforce branch rules or environment reviewers for this private
personal-account repository. Because GitHub forbids authors from approving
their own PRs, the promotion workflow treats the owner-only manual dispatch and
required exact SHA as approval. Native reviewer enforcement requires moving the
repository to an organization with GitHub Team or Enterprise.

## Inventory And Retirement

Every active hosted function must be manifest-owned. A stale function is
temporarily allowed only by an unexpired file under `retirements/`. Removal is
explicit and manual after caller verification. The orchestrator never prunes.

## Migrations

Files already present on `prod` are immutable. A new migration begins with:

```sql
-- service-owner: <service-key>
```

Create migrations with the pinned Supabase CLI. Schema ownership changes and
cross-service changes require an accepted ADR before the migration is added.
