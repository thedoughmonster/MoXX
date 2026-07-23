# 0008: Use One Local Migration And Release Coordinator

- Status: accepted
- Date: 2026-07-14
- Amendment: 2026-07-23; the authoritative Linux release host must use its
  authenticated CLI profile and the CLI-owned short-lived login role.

## Context

Manual plugin migration created hosted versions that differed from repository
filenames. Direct database hosts also depended on IPv6, which was unreliable on
the approved Windows environment. Releasing code and schema through unrelated
steps made a healthy deployment require repeated agent decisions.

## Decision

A pinned Node 24 coordinator provides `pnpm release:dev` and
`pnpm release:prod`. It is the sole normal caller of Supabase `db push` and must
use the authenticated pinned CLI's exact-project `--linked` transport.

Each migration apply is previewed, ordered, noninteractive, and followed by an
exact comparison of local and hosted migration versions. The coordinator links
the selected ref again immediately before apply and validates the CLI's exact
`.temp/project-ref`. The CLI obtains its own short-lived login role and keeps
that generated credential inside the CLI process. Repository code never reads,
passes, logs, hashes, or stores it. Migrations must remain backward-compatible
because schema can precede code while GitHub completes.

GitHub Actions remains the sole Edge Function deployment authority. Development
function deployment changes from an automatic push to exact-SHA dispatch after
the coordinator proves migration parity. Production uses an exact-SHA
fast-forward followed by an explicit exact-SHA production dispatch.

A development feature branch with an empty migration-tree diff may reuse the
exact current `dev` commit's already-proven parity only when that commit has a
successful `deploy-dev.yml` receipt. This path opens no database connection.
Every release computes its migration requirement against the selected
environment baseline. A nonempty migration diff opens a database connection
and performs preflight, preview, apply, and parity. A direct `dev` rerun does
the same so a previously merged but interrupted migration release can recover.

The local account token stays in the approved release host's CLI credential
store. GitHub deployment tokens stay in protected GitHub secrets, and runtime
secrets stay in Supabase. The local token is not duplicated into Supabase
because doing so is circular and would expose account-management authority to
project runtime.

On the authoritative Linux release host, the CLI profile is authenticated by
OAuth or a personal access token. That account credential remains only in the
CLI credential store. Preflight links the exact target ref, validates the saved
ref, and proves access with one bounded `db query --linked` call. Preview,
apply, and parity use the same linked identity. The CLI creates and expires the
temporary database login internally; no repository child receives the account
token or generated database password as `SUPABASE_DB_PASSWORD`, `PGPASSWORD`,
an argument, a URL, or a receipt. The pinned CLI's remote path is TLS-only.

This supersedes ADR `0006` only where it paused migrations and required the
development function workflow itself to use a push event.

## Consequences

- A healthy environment release is one command with no planned checkpoint.
- A rerun can reuse merged PRs and successful exact-commit workflows.
- GitHub workflows cannot race ahead of development migrations.
- Code-only production promotions do not open a database connection.
- Migration history drift fails before function deployment.
- The Supabase plugin is reserved for inspection and explicit emergency repair.
