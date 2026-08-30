# Release credentials

Keen Pine holds durable operator credentials. Never ask for token values in
chat, commands, `.env`, repository content, packets, logs, or receipts.

## Custody

| Credential | Authoritative location |
| --- | --- |
| GitHub CLI account | `/root/.config/gh/` credential store |
| Development Supabase PAT | protected GitHub `dev` environment secret |
| Production Supabase workflow PAT | protected GitHub `prod` environment secret |
| Production release-host OAuth/PAT | authenticated release-host CLI profile |
| Database login | short-lived by default; an authorized non-expiring exception stays internal to the approved process |
| GitHub deployment token | protected GitHub environment secret |
| Runtime/API secret | Supabase Edge Function Secret; use the [branch-scoped names-only guide](supabase-edge-function-secrets.md) |

Verify GitHub with `gh auth status`. The development workflow validates its own
Supabase access without exposing it. Never read or export credential files. The
pinned CLI mints and uses its database login internally; repository children
strip `SUPABASE_DB_PASSWORD` and `PGPASSWORD`.

## Active-development non-expiring exception

While MoMi is in active development, an accepted Linear issue may authorize a
credential with no automatic expiry. The issue must bind one credential name
and purpose to the exact environments, projects, provider identity, minimum
required roles or scopes, and any available network restriction. It must also
name the owner, protected authoritative store, rotation and immediate-revocation
procedure, read-only verification, and rollback path. Non-expiring means valid
until revoked; it does not mean unowned or exempt from rotation after exposure,
owner change, scope change, failed verification, or the end of active
development. This policy creates no credential or provider mutation authority
by itself.

For Supabase token-to-database access, the issue must explicitly authorize that
use and the exact database role. The token may be consumed only inside the
approved workflow or pinned client after the provider access mapping is enabled.
Repository code must not copy it into `SUPABASE_DB_PASSWORD`, `PGPASSWORD`, a
connection URL, command argument, unrelated child process, artifact, or receipt,
and must not propagate it beyond the approved pinned client. If the issue does
not authorize this exact exception, the CLI-owned short-lived login remains
mandatory.

Cutover must disable the old credential consumer before removing its authority,
verify the new credential through the bounded read-only preflight, and retain a
known rollback path until that verification passes. Rollback disables the new
consumer first, restores the last authorized path, verifies it, and only then
revokes the replacement credential. No human, agent, diagnostic, verification
step, or evidence collector may read, print, copy, hash, measure, log, or record
the credential value or value-derived data; only the approved workflow or pinned
client may consume it for its authorized operation.

Repository-only development releases require no Supabase access. Migration
releases invoke the linked CLI preview/apply/parity path only in the protected
development workflow; Edge Function credentials stay in that same environment.
Edge Function deployment credentials are available only to the two authorized
GitHub workflows.

## Failure handling

1. Repeat sandbox-failed read-only auth checks with approved network access.
2. Repair only the failed credential authority after that check also fails.
3. For development migration auth, inspect the protected workflow; for
   production, verify the CLI profile, exact linked ref, and project membership.
   Use token-to-database access only when its accepted Linear issue authorizes
   the exact role and the active-development controls above are satisfied.
4. For repository-only release, any database login attempt is a tooling defect.

A sandbox can report an inaccessible token as invalid. That never authorizes
logout, login replacement, credential inspection, authority switching, or
workspace tooling removal.
