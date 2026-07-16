# Deployment

GitHub Actions is the sole deployment authority for repository code and Edge
Functions. The local Node 24 coordinator is the sole normal migration authority.
Supabase Git deployment remains disabled. ADRs `0006` and `0008` govern this.

## Release Commands

```text
pnpm release:dev
pnpm release:prod
```

Both commands require a clean worktree and secure CLI sign-in. Development may
start on a committed feature branch based on current `dev`, or on `dev` when
resuming an already merged release. Production must start on clean, current
`dev`. Neither command commits unknown work.

The development command owns feature PR creation and merge, exact-commit
validation, migration preview/apply/parity, and GitHub workflow dispatch. The
production command owns the promotion PR, production migration, exact-SHA
promotion, and hosted completion proof.

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

The coordinator links the selected project, rejects anything except the IPv4
session pooler on port 5432, previews `db push`, applies it, and compares every
local migration version with hosted history. GitHub workflows never apply
migrations and local code never deploys Edge Functions.

Files already present on `prod` are immutable. A new migration begins with:

```sql
-- service-owner: <service-key>
```

## Credentials

The permanent local Supabase CLI token is stored by the CLI in Windows
Credential Manager. GitHub environment secrets authorize GitHub's function
deployment. Supabase project secrets authorize runtime integrations. No token
value belongs in a repository file, `.env`, command log, or release record.

## Retirement

Every active hosted function must be manifest-owned. A stale function is
temporarily allowed only by an unexpired file under `retirements/`. Removal is
explicit after caller verification; the coordinator never prunes.
