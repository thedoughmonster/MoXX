# Release credentials

Keen Pine already holds the durable operator credentials. Agents reuse them;
they never ask Zac to paste token values into chat, commands, `.env` files, or
repository content.

## GitHub

- Purpose: Git operations, pull requests, checks, and workflow dispatch.
- Custody: the GitHub CLI credential store under `/root/.config/gh/`.
- Verify without exposing it: `gh auth status`.
- Normal use: call `git` and `gh`; never read or export the token value.

## Supabase

- Purpose: Supabase CLI management calls and PAT-based temporary Postgres
  access when a release contains migrations.
- Custody: `/root/.supabase/access-token`, a root-owned `0600` regular file.
- Verify management access without exposing it: `pnpm exec supabase projects list`.
- Code-only development release: `pnpm release:dev`.
- Migration-bearing development release: `/root/momi-release dev`.
- Production release: `/root/momi-release prod`.

The host wrapper validates the credential file, loads its value only into the
release process as `SUPABASE_DB_PASSWORD`, and never prints, hashes, copies, or
places it in an argument or URL. The database-only child mirrors it to
`PGPASSWORD`; all other children strip both variables.

The PAT and its database mapping are separate controls. The PAT may be
non-expiring, while Supabase project membership, temporary-access enablement,
role mapping, IP restrictions, or an explicit revocation can still deny a
database connection.

Official behavior:

- <https://supabase.com/docs/guides/platform/temporary-access>
- <https://supabase.com/changelog/46346-feature-preview-temporary-token-based-database-access>

## Runtime secrets

Supabase Edge Function secrets remain in Supabase. Host application credentials
remain in their root-controlled credential files. Neither class is a release
credential, and neither belongs in the GitHub or Supabase CLI stores.

## Failure handling

An authentication failure names the failed control:

1. `gh auth status` failure: first repeat the same read-only check with approved
   GitHub network access. A sandbox can report an inaccessible token as invalid.
   Only repair the CLI session if the network-enabled check also fails.
2. Supabase project-list failure: repair only the Supabase CLI PAT.
3. Migration database failure: inspect temporary-access enablement, the mapped
   user and role, Keen Pine's allowed IP, and project membership.
4. Code-only release: no database credential is required; a database login
   failure must not block it.

Never switch deployment authority, expose a token for diagnosis, or remove
workspace tooling. A sandbox-only auth failure never authorizes logout,
re-login, token replacement, credential inspection, or tooling removal.
