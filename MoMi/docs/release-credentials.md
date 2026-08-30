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

### MOX-409 production authority

The operator decision recorded in Linear issue `MOX-409` on 2026-08-30 selects
the non-scheduled model for `thedoughmonster/MoXX`. `dev` is the authoritative
integration branch; production workflow configuration remains on `prod`. The
dedicated non-expiring Supabase PAT or Scoped PAT is stored only as the protected
GitHub `prod` environment secret `SUPABASE_ACCESS_TOKEN`, owned by Zac.

The token has exactly two repository consumers, both `workflow_dispatch` events
on `prod`: `.github/workflows/deploy-prod.yml` may consume it through the pinned
Supabase client for receipt-bound function deployment, and
`.github/workflows/supabase-credential-preflight.yml` may consume it for GET-only
verification. Its database authority is that token owner's existing production
`postgres` role mapping with accepted network and role restrictions preserved
and no `expires_at`. The release-host CLI profile is a separate credential and
continues to use the CLI-owned short-lived database login for production
migrations; MOX-409 does not grant that profile non-expiring database access.

MoXX registers no monthly or other scheduled renewal event and contains no
renewal PUT path. The preflight first enforces exact repository, workflow, event,
environment, and matching branch before receiving the secret. It then checks the
exact production project, applied temporary-access feature state, and expiry-free
mapping without printing user identity, restrictions, token, or value-derived
data. Only Zac may establish or repair the one-time provider mapping; neither
repository workflow may mutate it.

After that check passes, MOX-390 may disable the source schedule and confirm both
repositories have zero registered renewal schedules. The source is
`thedoughmonster/momi-backend`, workflow
`.github/workflows/renew-database-access.yml`; its prior credential remains the
source GitHub `prod` environment secret `SUPABASE_ACCESS_TOKEN`, owned by Zac.
Keep that credential and mapping until the replacement passes.

The MOX-390 retirement order is: prove the MoXX production preflight; disable
the source workflow without deleting its file or history; verify its GitHub
workflow state is `disabled_manually`; and verify MoXX has no registered renewal
workflow. Its rollback drill is proof-only. Before prior-credential revocation,
the names-only rollback restores the source `prod` secret from its protected
owner-held source and restores its prior provider mapping, then verifies it
read-only. Re-enabling the source scheduler is not part of MOX-409 and requires
separate explicit authority. After prior-credential revocation, revoke a failed
replacement and issue another through the same bounded process instead of
restoring the source schedule.

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
