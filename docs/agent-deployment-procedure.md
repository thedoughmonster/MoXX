# Agent Deployment Procedure

GitHub issues own work, PR CI owns final validation, the local Node 24
coordinator owns ordered database migration, and two GitHub workflows alone own
Edge Function deployment.

## Publish and validate

1. Work in one isolated feature worktree from exact current `dev`.
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
impact digest, and gate exactly match the validation receipt. It also verifies
the receipt's exact GitHub run and successful `validate-final` job.

- Repository-only plans write a release receipt with no database access and no
  Edge Function workflow dispatch.
- Migration plans use the authenticated pinned Supabase CLI to link the exact
  project, preview, apply, and prove history parity.
- Function plans dispatch `deploy-dev.yml` with only affected manifest-owned
  services and the exact plan/tree identity.

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
- The Supabase account credential remains in the authenticated CLI profile.
- Authenticate through OAuth or a personal access token; do not substitute the account PAT as a database password.
- The CLI alone creates and uses its short-lived database login.
- Repository children strip `SUPABASE_DB_PASSWORD` and `PGPASSWORD`.
- GitHub deployment tokens remain protected environment secrets.
- Runtime/API secrets remain Supabase Edge Function secrets.
- No credential value enters a command, URL, log, commit, packet, or receipt.

Only `scripts/release/apply_migrations.ts` may call `db push`. Each apply uses
`--linked`, reads hosted history before its dry-run, ends with exact parity, and
never rewrites an applied migration. The default command omits `--include-all`.
The coordinator adds it only for receipt-authorized locally missing migrations
that are ordered before the hosted tip, after rejecting unknown hosted versions
and unexplained local gaps. The dry-run must list exactly those local filenames
before the same selected arguments can apply them. No release flag or
environment variable can override these checks. GitHub workflows never apply
migrations.

## Failure and rollback

Inspect the exact failed job or migration step and fix the owning change. Do not retry through a different deployment authority. Stop for destructive effects,
secret exposure, production exposure without authority, or inability to prove
rollback. Git revert is code rollback; applied schema corrections are additive
migrations.
