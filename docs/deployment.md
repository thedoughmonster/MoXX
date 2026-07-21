# Deployment

GitHub Actions is the sole deployment authority for repository code and Edge
Functions. The local Node 24 coordinator is the sole normal migration authority.
Supabase Git deployment remains disabled. ADRs `0006` and `0008` govern this.

## Release Commands

```text
pnpm release:dev
pnpm release:prod
```

Both commands require a clean worktree and a Supabase CLI profile authenticated
by OAuth or a personal access token with temporary access to the exact target
project. They do not require a database password. Development may start on a
committed feature branch based on current `dev`, or on `dev` when resuming an
already merged release. Production must start on clean, current `dev`. Neither
command commits unknown work.

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

Preflight links the exact selected ref, validates `.temp/project-ref` and the
password-free `.temp/pooler-url`, then proves authenticated access through one
bounded read-only `db query --linked` over the exact-ref HTTPS Management API.
It does not depend on top-level project enumeration because persistent branches
may not appear there.

Migration apply links and validates the exact ref again, previews with
`db push --linked --dry-run --yes`, applies with `db push --linked --yes`, and
queries linked migration history through the exact-ref HTTPS Management API for
exact parity. The pinned CLI may mint a short-lived login role and fall back
from unreachable direct IPv6 to the saved, ref-validated IPv4 session pooler on
port 5432. That URL must use the approved
Supabase profile domain, exact project username, session database, and no
password, query, or fragment. Remote CLI database connections are TLS-only; the
policy does not claim certificate `verify-full` without the dashboard CA.
Every Supabase child strips ambient `SUPABASE_DB_PASSWORD` and `PGPASSWORD`.
The coordinator rejects `--debug`, which changes the database transport.
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

The local Supabase OAuth or personal access token is stored by the CLI on the
approved release host. Its linked temporary database credential is created and
used internally by the pinned CLI and is never read or logged by the
coordinator. GitHub environment secrets authorize GitHub's function deployment.
Supabase project secrets authorize runtime integrations. No credential value
belongs in a repository file, `.env`, command log, or release record.

## Retirement

Every active hosted function must be manifest-owned. A stale function is
temporarily allowed only by an unexpired file under `retirements/`. Removal is
explicit after caller verification; the coordinator never prunes.
