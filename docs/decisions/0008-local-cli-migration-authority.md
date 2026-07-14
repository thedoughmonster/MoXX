# 0008: Use One Local Migration And Release Coordinator

- Status: accepted
- Date: 2026-07-14

## Context

Manual plugin migration created hosted versions that differed from repository
filenames. Direct database hosts also depended on IPv6, which was unreliable on
the approved Windows environment. Releasing code and schema through unrelated
steps made a healthy deployment require repeated agent decisions.

## Decision

A pinned Node 24 coordinator provides `pnpm release:dev` and
`pnpm release:prod`. It is the sole normal caller of Supabase `db push` and must
use the authenticated pinned CLI through the IPv4 session pooler on port 5432.

Each migration apply is previewed, ordered, noninteractive, and followed by an
exact comparison of local and hosted migration versions. Migrations must remain
backward-compatible because schema can precede code while GitHub completes.

GitHub Actions remains the sole Edge Function deployment authority. Development
function deployment changes from an automatic push to exact-SHA dispatch after
the coordinator proves migration parity. Production uses an exact-SHA
fast-forward followed by an explicit exact-SHA production dispatch.

The local account token stays in Windows Credential Manager. GitHub deployment
tokens stay in protected GitHub secrets, and runtime secrets stay in Supabase.
The local token is not duplicated into Supabase because doing so is circular and
would expose account-management authority to project runtime.

This supersedes ADR `0006` only where it paused migrations and required the
development function workflow itself to use a push event.

## Consequences

- A healthy environment release is one command with no planned checkpoint.
- A rerun can reuse merged PRs and successful exact-commit workflows.
- GitHub workflows cannot race ahead of development migrations.
- Migration history drift fails before function deployment.
- The Supabase plugin is reserved for inspection and explicit emergency repair.
