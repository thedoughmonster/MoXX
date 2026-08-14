# 0008: Use One Local Migration And Release Coordinator

- Status: accepted
- Date: 2026-07-14
- Amendment: 2026-07-23; the authoritative Linux release host must use its
  authenticated CLI profile and the CLI-owned short-lived login role.
- Amendment: 2026-07-23; release consumes one exact PR validation receipt,
  repository-only plans bypass database/deployment, and production consumes the
  exact development receipt without revalidation.
- Amendment: 2026-08-14; development migration execution moved into the
  receipt-bound protected GitHub deployment workflow so an owning agent needs
  no locally transferable Supabase credential.

## Context

Manual plugin migration created hosted versions that differed from repository
filenames. Direct database hosts also depended on IPv6, which was unreliable on
the approved Windows environment. Releasing code and schema through unrelated
steps made a healthy deployment require repeated agent decisions.

## Decision

A pinned Node 24 coordinator provides receipt-bound `pnpm release:dev` and
`pnpm release:prod`. It is the sole release orchestrator. The shared migration
module is the only caller of Supabase `db push` and uses the pinned CLI's
exact-project `--linked` transport.

Each migration apply is previewed, ordered, noninteractive, and followed by an
exact comparison of local and hosted migration versions. The migration module
links the selected ref again immediately before apply and validates the CLI's exact
`.temp/project-ref`. The CLI obtains its own short-lived login role and keeps
that generated credential inside the CLI process. Repository code never reads,
passes, logs, hashes, or stores it. Migrations must remain backward-compatible
because schema can precede code while GitHub completes.

GitHub Actions remains the sole Edge Function deployment authority. Development
uses one exact-SHA/tree/plan dispatch to apply migrations, prove parity, and
then deploy only affected manifest-owned functions. Production uses
receipt-bound exact-SHA fast-forward followed by affected-only dispatch.

A repository-only release opens no database connection and dispatches no
application deployment. A nonempty migration diff performs link, preview,
apply, and parity before affected-only function deployment. A runtime-only plan
opens no database connection.

The development account token stays in the protected GitHub environment;
production's stays in the approved release host's CLI credential store.
Runtime secrets stay in Supabase. Neither account token is duplicated into
project runtime.

On the authoritative Linux release host, the CLI profile is authenticated by
OAuth or a personal access token. That account credential remains only in the
CLI credential store. Apply links the exact target ref, validates the saved
ref, then previews, applies, and proves parity with that linked identity.
The CLI creates and expires the
temporary database login internally; no repository child receives the account
token or generated database password as `SUPABASE_DB_PASSWORD`, `PGPASSWORD`,
an argument, a URL, or a receipt. The pinned CLI's remote path is TLS-only.

This supersedes ADR `0006` only where it paused migrations and required the
development function workflow itself to use a push event.

## Consequences

- A healthy development release is one agent-executable command with no credential handoff.
- A rerun reuses exact receipts and successful required jobs idempotently.
- GitHub workflows cannot race ahead of development migrations.
- Code-only production promotions do not open a database connection.
- Repository validation runs once for the final PR tree and is not repeated on
  `dev`, production promotion, or production deployment.
- Migration history drift fails before function deployment.
- The Supabase plugin is reserved for inspection and explicit emergency repair.
