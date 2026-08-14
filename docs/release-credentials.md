# Release credentials

Keen Pine holds durable operator credentials. Never ask for token values in
chat, commands, `.env`, repository content, packets, logs, or receipts.

## Custody

| Credential | Authoritative location |
| --- | --- |
| GitHub CLI account | `/root/.config/gh/` credential store |
| Development Supabase PAT | protected GitHub `dev` environment secret |
| Production Supabase OAuth/PAT | authenticated release-host CLI profile |
| CLI database login | short-lived and internal to the CLI |
| GitHub deployment token | protected GitHub environment secret |
| Runtime/API secret | Supabase Edge Function Secret |

Verify GitHub with `gh auth status`. The development workflow validates its own
Supabase access without exposing it. Never read or export credential files. The
pinned CLI mints and uses its database login internally; repository children
strip `SUPABASE_DB_PASSWORD` and `PGPASSWORD`.

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
   Never substitute the PAT as a database password.
4. For repository-only release, any database login attempt is a tooling defect.

A sandbox can report an inaccessible token as invalid. That never authorizes
logout, login replacement, credential inspection, authority switching, or
workspace tooling removal.
