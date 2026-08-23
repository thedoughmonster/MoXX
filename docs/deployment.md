# Deployment

GitHub Actions is the sole hosted development and Edge Function deployment
authority. The local Node 24 coordinator is the sole release orchestrator.
Supabase Git deployment remains disabled. ADRs `0006` and `0008` govern this.

## Deterministic plan and validation

```text
pnpm momi-impact plan --base <sha> --head <sha>
pnpm momi-check changed
```

The impact plan binds exact commit/tree/diff identities, classifies changed
paths, explains focused and final checks, names migrations, and selects affected
manifest-owned services/functions. Runtime, architecture, manifest, migration,
and unknown impact receive the full gate. Docs, workflows, issue automation, and
repository tooling receive the path-scoped gate.

Every planned command declares `hard_stop` or `advisory` enforcement. Missing or
unknown enforcement fails closed. Source-quality errors, including handwritten
files above 140 lines, remain hard with quality-report JSON validity, catalog
checks, tests, and all other safety and release rules. Handwritten non-SQL files
from 121 through 140 lines produce `source-quality-soft-limit` advisory evidence.
`quality-report-freshness` is also advisory and identifies
`docs/quality-metrics.json` with the `pnpm quality:generate` repair command.

An advisory finding is retained in the compact receipt and GitHub step summary,
but cannot make the hard gate fail. The summary binds the exact base/head/tree,
diff, impact, and plan identities. `pnpm quality:check` displays soft-limit
findings without letting them determine its exit, while still enforcing hard
source-quality errors and freshness when regenerating the committed snapshot.

Iteration uses focused checks. The PR job `validate-final` runs exactly one
authoritative final plan and uploads its compact receipt. Neither merge to `dev`
nor promotion to `prod` repeats repository validation.
Until repository rules can enforce that job, the operator must verify its exact
successful receipt before merge.

## Release

```text
pnpm release:dev -- --validation-receipt <validation-receipt.json>
pnpm release:prod -- --dev-receipt <dev-release-receipt.json>
```

Development accepts only the validated tree, diff, impact, and gate. A merge SHA
may differ as benign technical drift only when those identities are equal.
The coordinator verifies the receipt's exact GitHub run and required job.
Development migrations run inside the protected deployment workflow before
affected functions; the agent needs GitHub CLI access, not a local Supabase token.
Production consumes the exact development receipt. The coordinator creates or
reuses the sole exact `dev`-to-`prod` promotion PR and makes it ready before
dispatching the receipt-bound fast-forward workflow.

- Repository-only: no database access and zero Edge Function deployments.
- External authority change: dispatch the protected development workflow, deploy
  and probe zero functions, assert full hosted inventory, and record the result.
- Service change: deploy only affected manifest-owned functions.
- Migration: CLI preview, apply, parity, then affected-only function deployment.
- Unknown impact: stop before release; never guess or deploy everything.

Release workflow polling is bounded to the exact required job. Required-job
success is deterministic even if aggregate run state has not propagated.

## Deployment boundary

Only `.github/workflows/deploy-dev.yml` and `deploy-prod.yml` call
`deploy:apply`. Each dispatch carries exact SHA, validated tree, plan digest,
and affected service list. The apply entry point rejects local execution, wrong
branch/workflow, or invalid identity. An empty service selection is accepted only
for a plan-bound development inventory assertion or migration-only release.

The entry point uses the pinned CLI with `--use-api`, checks full hosted
inventory, probes only affected functions, reads advisors, and writes a release
artifact. It never uses Docker, `--prune`, or implicit function discovery.

## Migration boundary

Only `scripts/release/apply_migrations.ts` calls `db push`. Development invokes
it inside `deploy-dev.yml`; production invokes it from the coordinator. It links
and checks
the exact project, reads hosted migration history, and compares every locally
missing version with the migration set in the accepted validation plan. The
default preview and apply omit `--include-all`. The release module derives
`--include-all` only when every locally missing migration is authorized by that
plan, at least one is ordered before the hosted tip, hosted history has no
version unknown to local files, and local history has no unexplained missing
version.

The dry-run output must name every and only the authorized missing filename in
local order. Only then does the release module apply with the same derived
arguments and verify final exact migration-history parity. Any inventory,
preview, apply, or parity mismatch stops the release. There is no caller flag,
environment bypass, or manual release override for this path.

The authenticated CLI owns its short-lived database login; repository code
passes no password, database URL, JIT option, or credential-shaped receipt data.

Files already on `prod` are immutable. Every new migration starts on physical
line 1 with:

```sql
-- service-owner: <service-key>
```

The owner selects affected services after parity. Only `deploy-dev.yml` applies
development migrations, and local code never deploys Edge Functions.

## Rollback

Git history is repository rollback. Applied schema is corrected by a later
ordered migration, never mutation. Hosted function removal still requires an
expiring retirement manifest and caller-verified explicit removal; no release
uses `--prune`.
