# 0008: Use One Local Migration And Release Coordinator

- Status: accepted
- Date: 2026-07-14
- Amendment: the authoritative Linux release host must use its authenticated
  CLI profile and an exact-project passwordless linked connection.

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
exact comparison of local and hosted migration versions. The coordinator links
the selected ref again immediately before apply, validates the CLI's exact
`.temp/project-ref` and password-free `.temp/pooler-url` evidence, and uses only
`db push --linked` and `db query --linked`. Migrations must remain
backward-compatible because schema can precede code while GitHub completes.

GitHub Actions remains the sole Edge Function deployment authority. Development
function deployment changes from an automatic push to exact-SHA dispatch after
the coordinator proves migration parity. Production uses an exact-SHA
fast-forward followed by an explicit exact-SHA production dispatch.

The local account token stays in the approved release host's CLI credential
store. GitHub deployment tokens stay in protected GitHub secrets, and runtime
secrets stay in Supabase. The local token is not duplicated into Supabase
because doing so is circular and would expose account-management authority to
project runtime.

On the authoritative Linux release host, the CLI profile is authenticated by
OAuth or a personal access token held only in the Supabase CLI credential
store. Preflight links the exact target ref, validates the saved linked evidence,
and proves access with one bounded read-only `db query --linked` through the
exact-ref HTTPS Management API before repository validation. A persistent
branch need not appear in `projects list`, so top-level project enumeration is
not an access gate.

The pinned CLI exchanges the authenticated profile identity for a short-lived
CLI login role when a linked database command needs PostgreSQL access. It first
uses the exact linked ref and direct host, then may fall back from unreachable
IPv6 to the ref-validated IPv4 session pooler on port 5432. The saved pooler URL
must use the exact project username, approved Supabase profile domain, session
database, and contain no password, query, or fragment. The pinned CLI permits
only TLS remote connections and rejects mismatched profile-domain, ref, or
pooler identity. We do not claim certificate `verify-full` without the
Supabase dashboard CA. Ambient `SUPABASE_DB_PASSWORD` and `PGPASSWORD` are
removed from every Supabase child; no database password is required.

This supersedes ADR `0006` only where it paused migrations and required the
development function workflow itself to use a push event.

## Consequences

- A healthy environment release is one command with no planned checkpoint.
- A rerun can reuse merged PRs and successful exact-commit workflows.
- GitHub workflows cannot race ahead of development migrations.
- Migration history drift fails before function deployment.
- The Supabase plugin is reserved for inspection and explicit emergency repair.
