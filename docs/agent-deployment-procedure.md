# Agent Deployment Procedure

Use this path for every hosted change. A permission failure is a routing signal,
not a reason to try another publisher.

## Before Release

1. Read root and affected service instructions and manifests.
2. Start from current `dev` and make one intentional feature branch.
3. Commit the complete change and confirm the worktree is clean.
4. Keep secrets out of commands, logs, commits, manifests, and release records.

## Release To Dev

Run exactly:

```text
pnpm release:dev
```

The Node 24 coordinator checks the repository, pushes the feature branch,
creates or resumes its PR, waits for GitHub validation, merges it, and waits for
the exact `dev` commit validation. It then links the development database over
the IPv4 session pooler, previews and applies ordered migrations, proves local
and hosted history parity, and dispatches the exact-SHA development workflow.

Only that GitHub workflow may deploy Edge Functions. The coordinator resumes
completed stages without creating a second successful deployment for a commit.

## Release To Production

From clean `dev` matching `origin/dev`, run exactly:

```text
pnpm release:prod
```

The coordinator creates or resumes the `dev`-to-`prod` PR, waits for checks,
applies and verifies production migrations, then dispatches exact-SHA promotion.
GitHub fast-forwards `prod`, deploys its Edge Functions, and records the release.

Never merge or push `prod` directly. Never deploy an Edge Function with the
Supabase plugin, CLI, dashboard, or a local script.

## Credentials

| Credential | Authoritative location |
| --- | --- |
| Local Supabase CLI token | Supabase CLI credential store on the release host |
| Local database password | Transient `SUPABASE_DB_PASSWORD` release environment |
| GitHub deployment token | Protected GitHub environment secret |
| Runtime/API secret | Supabase Edge Function Secret |

The local Supabase token and database password are account-management
credentials. Preflight requires the token to enumerate the exact target project
and requires a database password so the CLI cannot use a temporary login role.
Do not copy either credential into Supabase runtime secrets, Vault, `.env`,
GitHub, the repository, commands, or logs.

## Database Controls

- `scripts/release/apply_migrations.ts` is the sole normal `db push` caller.
- Preview, apply, and parity use one validated password-free
  `*.pooler.supabase.com:5432` URL with verified TLS; direct IPv6 is rejected.
- Only database children receive the password, as `PGPASSWORD`; it must never
  appear in a URL, argument, log, file, or release record.
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
