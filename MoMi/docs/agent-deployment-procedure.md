# Agent Deployment Procedure

GitHub issues own work, PR CI owns final validation, the local Node 24
coordinator owns receipt-bound orchestration, and protected GitHub workflows
own hosted development migration and Edge Function deployment.

## Publish and validate

1. Work in one isolated feature worktree from exact current `dev`.
   Refresh the tracking ref with
   `git fetch origin refs/heads/dev:refs/remotes/origin/dev`; a narrowed
   `git fetch origin dev` updates `FETCH_HEAD` only and is not a freshness
   precondition.
2. Run `pnpm momi-check changed` while iterating.
3. Commit, push, and open one draft PR to `dev` with exactly one owning issue and
   `Disposition: partial|complete`.
4. Let the PR job named `validate-final` derive and run exactly one final gate.
5. Download its `validation-<head-sha>` artifact after success.

Do not run the same full gate locally and in PR CI. `dev` and `prod` pushes do
not trigger another repository validation.

## Release development

After the validated tree is merged and clean local `dev` equals `origin/dev`:

```text
pnpm release:dev -- --validation-receipt <validation-receipt.json>
```

The coordinator accepts a benign descendant merge SHA only when the tree, diff,
impact digest, and gate exactly match the validation receipt. It verifies the
receipt's exact GitHub run and successful `validate-final` job, then dispatches
the protected development workflow and waits for its exact required job.

- Repository-only plans write a release receipt with no database access and no
  Edge Function workflow dispatch.
- Migration plans make `deploy-dev.yml` use its authenticated pinned Supabase
  CLI to link the exact project, preview, apply, and prove history parity.
- Function plans deploy only affected manifest-owned services after parity.
- Caller-verified expired development functions may be removed only when their
  manifest carries dated issue evidence and the exact validation receipt names
  them through `--retire-functions`; the coordinator never prunes inventory.

The coordinator polls the exact required job with a bound. A successful required
job is authoritative even while aggregate run state is lagging.

## Release production

Production requires the exact development release receipt:

```text
pnpm release:prod -- --dev-receipt <dev-release-receipt.json>
```

The coordinator never reruns repository validation. It verifies the exact
development tree/diff/plan, applies and verifies production migrations when
present, dispatches receipt-bound promotion, and deploys only the same affected
services. Protected GitHub environments remain the production exposure gate.

Never merge or push `prod` directly. Never deploy an Edge Function with the
Supabase plugin, CLI, dashboard, or local code.

## Credential and database boundaries

- GitHub credentials remain in the GitHub CLI credential store.
- Development Supabase credentials remain protected GitHub environment secrets.
- The workflow authenticates through its account token and never substitutes it
  as a database password; the CLI creates and uses its short-lived database login.
- Repository children strip `SUPABASE_DB_PASSWORD` and `PGPASSWORD`.
- GitHub deployment tokens remain protected environment secrets.
- Runtime/API secrets remain Supabase Edge Function secrets and follow the
  [branch-scoped placement and verification guide](supabase-edge-function-secrets.md).
- No credential value enters a command, URL, log, commit, packet, or receipt.

Only `scripts/release/apply_migrations.ts` may call `db push`. Development calls
it from `deploy-dev.yml`; production calls it from the release coordinator.
Each apply uses
`--linked`, reads hosted history before its dry-run, ends with exact parity, and
never rewrites an applied migration. The default command omits `--include-all`.
The release code adds it only for receipt-authorized locally missing migrations
that are ordered before the hosted tip, after rejecting unknown hosted versions
and unexplained local gaps. The dry-run must list exactly those local filenames
before the same selected arguments can apply them. No release flag or
environment variable can override these checks. No other GitHub workflow applies
migrations.

## Failure and rollback

Inspect the exact failed job or migration step and fix the owning change. Do not retry through a different deployment authority. Stop for destructive effects,
secret exposure, production exposure without authority, or inability to prove
rollback. Git revert is code rollback; applied schema corrections are additive
migrations.
