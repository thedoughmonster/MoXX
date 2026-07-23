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

- Purpose: authenticate Supabase CLI management calls. The CLI separately mints
  a short-lived database login role when a release contains migrations.
- Custody: `/root/.supabase/access-token`, a root-owned `0600` regular file.
- Verify management access without exposing it: `pnpm exec supabase projects list`.
- Code-only development release: `pnpm release:dev`.
- Migration-bearing development release: `/root/momi-release dev`.
- Production release: `/root/momi-release prod`.

The host wrapper validates the credential file metadata without reading or
exporting its value. Linked database commands let the CLI create and use its
own short-lived login role internally. Repository code never receives the PAT
or generated database password. Every child strips ambient
`SUPABASE_DB_PASSWORD` and `PGPASSWORD`.

The PAT may be non-expiring, while project membership or explicit revocation
still denies CLI access. The database login is independently short-lived and
exists only for the native CLI operation.

Official behavior:

- <https://supabase.com/docs/reference/api/introduction>

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
3. Migration database failure: verify the authenticated CLI profile, exact
   linked ref, short-lived login-role creation, and project membership.
4. Code-only release: no database credential is required; a database login
   failure must not block it.

Never switch deployment authority, expose a token for diagnosis, or remove
workspace tooling. A sandbox-only auth failure never authorizes logout,
re-login, token replacement, credential inspection, or tooling removal.
