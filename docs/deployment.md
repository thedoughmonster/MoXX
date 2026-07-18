# Deployment

GitHub Actions is the sole deployment authority for repository code and Edge
Functions. The local Node 24 coordinator is the sole normal migration authority.
Supabase Git deployment remains disabled. ADRs `0006` and `0008` govern this.

## Release Commands

```text
pnpm release:dev
pnpm release:prod
```

Both commands require a clean worktree, secure CLI sign-in, access to the exact
target project, and a transient `SUPABASE_DB_PASSWORD`. Development may start
on a committed feature branch based on current `dev`, or on `dev` when resuming
an already merged release. Production must start on clean, current `dev`.
Neither command commits unknown work.

The development command owns feature PR creation and merge, exact-commit
validation, migration preview/apply/parity, and GitHub workflow dispatch. The
production command owns the promotion PR, exact-commit development validation,
production migration preview/apply/parity, guarded exact-SHA promotion,
production validation, and hosted completion proof.

Validation resolves the exact successful `dev` push used as its debt baseline.
A production push uses its own already validated SHA rather than a moving
`origin/dev`; production waits for that development validation, applies its
migrations, dispatches the guarded promotion, verifies the resulting `prod`
SHA, waits for production validation, and only then dispatches deployment. This
private personal repository cannot enforce a server-side ruleset protecting the
validation workflow itself. Until it moves to a plan with enforceable branch
rules, operator review of workflow changes remains a required trust boundary; a
successful run is not a self-authenticating proof of the workflow code that
produced it.

## Deployment Boundary

`npm run deploy:apply` remains executable only inside the matching GitHub
workflow. Development requires `workflow_dispatch`, `refs/heads/dev`, and an
input matching `GITHUB_SHA`. Production requires the same exact-SHA dispatch
after the promotion workflow fast-forwards `prod`.

The apply entry point deploys manifest-owned functions with the pinned CLI and
`--use-api`, checks inventory, probes functions, reads advisors, and writes a
release artifact. It never uses Docker, `--prune`, or implicit discovery.
An unauthenticated probe must return success for public functions; a configured
JWT-protected function may instead prove reachability with `401` or `403`.

## Migration Boundary

The coordinator links the selected project, validates its password-free IPv4
session-pooler URL on port 5432, and adds verified TLS. Preview, apply, and
hosted-history parity all use that exact URL. The database password reaches only
those database children as `PGPASSWORD`; it never enters a URL or argument. The
coordinator rejects the CLI `--debug` flag, which changes the database transport
and cannot validate the normal TLS path.
GitHub workflows never apply migrations and local code never deploys Edge
Functions.

Files already present on `prod` are immutable. A migration not present in the
production baseline has exactly one ownership header on physical line 1:

```sql
-- service-owner: <service-key>
```

`supabase/migrations/` is flat and contains only its `AGENTS.md` plus regular,
non-executable `.sql` files.

## Credentials

The permanent local Supabase CLI token is stored by the CLI on the approved
release host. The database password is supplied only through the release
process's `SUPABASE_DB_PASSWORD` environment. GitHub environment secrets
authorize GitHub's function deployment. Supabase project secrets authorize
runtime integrations. No credential value belongs in a repository file,
`.env`, command log, or release record.

## Retirement

Every active hosted function must be manifest-owned. A stale function is
temporarily allowed only by an unexpired file under `retirements/`. Removal is
explicit after caller verification; the coordinator never prunes.
