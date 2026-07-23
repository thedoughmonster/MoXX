# Agent Deployment Procedure

Use this path for every hosted change. A permission failure is a routing signal,
not a reason to try another publisher.

## Before Release

1. Read root and affected service instructions and manifests.
2. Start from current `dev` and make one intentional feature branch.
3. Commit the complete change and confirm the worktree is clean.
4. Keep secrets out of commands, logs, commits, manifests, and release records.

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
For migration-bearing releases it then links the development database over
the IPv4 session pooler, previews and applies ordered migrations, proves local
and hosted history parity, and dispatches the exact-SHA development workflow.

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
| Temporary database login | `SUPABASE_DB_PASSWORD` for the release process |
| GitHub deployment token | Protected GitHub environment secret |
| Runtime/API secret | Supabase Edge Function Secret |

Authenticate the local CLI profile through OAuth or personal access token.
Export that temporary-access token as `SUPABASE_DB_PASSWORD`; it is the database
password for temporary access, not the long-lived Postgres role password.
On Keen Pine, `/root/momi-release` performs that export from the protected
Supabase CLI store without exposing the token. See `docs/release-credentials.md`.
Preflight links the exact target ref, validates the saved ref and password-free
pooler evidence, builds the exact JIT URL, and proves access with a bounded
read-only query. Repository code never reads a fixed token path. Do not copy the
token into Supabase runtime secrets, Vault, `.env`, GitHub, the repository,
commands, URLs, logs, or release records.

## Database Controls

- `scripts/release/apply_migrations.ts` is the sole normal `db push` caller.
- Preflight and apply each relink and assert the exact `.temp/project-ref`.
- The linked URL must use the exact ref username, approved Supabase pooler
  domain, IPv4 session pooler port 5432, session database, no secret, and only
  the decoded option `options=-c jit=true`.
- The pinned CLI's remote path is TLS-only; do not claim `verify-full` without
  the Supabase dashboard CA or bypass its exact profile/ref validation.
- Only the database child receives `SUPABASE_DB_PASSWORD`, mirrored to
  `PGPASSWORD`; every general child strips both variables.
- The coordinator rejects the Supabase CLI `--debug` flag because debug mode
  changes the database transport and cannot prove normal TLS connectivity.
- Every apply starts with a dry preview and ends with exact history parity.
- Applied migrations are immutable; corrections require a new migration.
- Migrations must remain backward-compatible if a later GitHub step is delayed.
- The Supabase plugin is for inspection or deliberate emergency repair only.

## Failure Routing

- Authentication failure: repair the named credential, then rerun the command.
- PR or workflow failure: inspect that GitHub run and fix the owning change.
- Migration failure: stop, inspect schema and history, then add a correction.
- Hosted behavior failure: preserve durable evidence and diagnose the owner.

Do not retry through a different deployment authority.
