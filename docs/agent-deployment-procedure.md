# Agent Deployment Procedure

Use this path for every hosted change. A permission failure is a routing signal,
not a reason to try another publisher.

## Before Release

1. Read root and affected service instructions and manifests.
2. Bind the change to one open issue under
   `docs/development-issue-ledger.md`.
3. Start from current `dev` and make one intentional feature branch.
4. Commit the complete change and confirm the worktree is clean.
5. Keep secrets out of commands, logs, commits, manifests, and release records.

## Release To Dev

For a feature with no migration-tree diff, run exactly:

```text
pnpm release:dev
```

For a feature that adds or changes unapplied migrations, run:

```text
/root/momi-release dev
```

The Node 24 coordinator checks the repository, pushes the feature branch,
creates or resumes its PR, waits for GitHub validation, merges it, and waits for
the exact `dev` commit validation. It detaches the release worktree at that
merged commit, so another worktree may safely retain the local `dev` branch.
It leaves feature-branch cleanup separate so GitHub cannot force a local branch
checkout while another worktree owns `dev`.
Because the coordinator creates a minimal PR body, its final feature commit must
contain the exact `Owning issue` and `Disposition` trailers documented in
`docs/development-issue-ledger.md`. Manually created PRs may put them in the PR
body instead.
For migration-bearing releases it links the exact development project through
the authenticated CLI, previews and applies ordered migrations with a
CLI-owned short-lived login role, proves local and hosted history parity, and
dispatches the exact-SHA development workflow.

Only that GitHub workflow may deploy Edge Functions. The coordinator resumes
completed stages without creating a second successful deployment for a commit.

## Release To Production

From clean `dev` matching `origin/dev`, run exactly:

```text
/root/momi-release prod
```

The coordinator creates or resumes the `dev`-to-`prod` PR, waits for checks,
applies and verifies production migrations, then dispatches exact-SHA promotion.
GitHub fast-forwards `prod`, deploys its Edge Functions, and records the release.

Never merge or push `prod` directly. Never deploy an Edge Function with the
Supabase plugin, CLI, dashboard, or a local script.

## Credentials

| Credential | Authoritative location |
| --- | --- |
| Local Supabase OAuth/PAT | Operator session and authenticated CLI profile |
| Temporary database login | Short-lived role owned internally by the Supabase CLI |
| GitHub deployment token | Protected GitHub environment secret |
| Runtime/API secret | Supabase Edge Function Secret |

Authenticate the local CLI profile through OAuth or a personal access token.
On Keen Pine, `/root/momi-release` validates the protected CLI store without
reading or exporting the token. The CLI mints its own short-lived database login
for linked migration commands and never returns that generated password to
repository code. See `docs/release-credentials.md`. Preflight links the exact
target ref, validates the saved ref, and proves access with a bounded linked
read-only query. Do not copy either credential into Supabase runtime secrets,
Vault, `.env`, GitHub, the repository, commands, URLs, logs, or release records.

## Database Controls

- `scripts/release/apply_migrations.ts` is the sole normal `db push` caller.
- Preflight and apply each relink and assert the exact `.temp/project-ref`.
- Preflight, dry-run, apply, and parity use the pinned CLI's `--linked`
  transport; repository code provides no database password or URL.
- The CLI-owned login role is temporary and credential values remain inside the
  CLI process. General children strip `SUPABASE_DB_PASSWORD` and `PGPASSWORD`.
- The pinned CLI's remote path is TLS-only and `--debug` remains forbidden.
- Every apply starts with a dry preview and ends with exact history parity.
- Applied migrations are immutable; corrections require a new migration.
- Migrations must remain backward-compatible if a later GitHub step is delayed.
- The Supabase plugin is for inspection or deliberate emergency repair only.

## Failure Routing

- Authentication failure: verify the CLI profile and native login-role
  transport; do not substitute the account PAT as a database password.
- PR or workflow failure: inspect that GitHub run and fix the owning change.
- Migration failure: stop, inspect schema and history, then add a correction.
- Hosted behavior failure: preserve durable evidence and diagnose the owner.

Do not retry through a different deployment authority.
