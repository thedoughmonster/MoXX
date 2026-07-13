# Deployment

GitHub Actions is the normal deployment authority. Supabase's GitHub connection
may remain visible, but automatic database or Edge Function deployment must be
disabled there so only one system can mutate an environment.

## Commands

```text
npm run check -- --service <key|all>
npm run deploy:plan -- --env <dev|prod> --service <key|all>
npm run deploy:apply -- --env <dev|prod> --service <key|all>
npm run inventory -- --env <dev|prod>
```

The apply command always runs checks, previews and applies migrations, deploys
explicit manifest-owned functions with the pinned CLI and `--use-api`, checks
hosted inventory, probes deployed functions, reads Supabase advisors, and writes
a release artifact. It never uses Docker, `--prune`, or implicit function
discovery.

## Credentials

The `dev` and `prod` GitHub environments each store one
`SUPABASE_ACCESS_TOKEN`. Deployment workflows pass that dedicated
`momi-backend-github-actions-permanent` PAT to the Supabase Management API and
as the temporary Postgres password. The PAT does not expire and must be revoked
immediately if exposure is suspected. Temporary `postgres` access is inherited
by the persistent dev branch from production and remains time-bounded
independently of the PAT.

The deployment runner uses the session pooler URL created by `supabase link`,
adds the required `jit=on` connection option when those two credential values
match, and supplies the secret through `PGPASSWORD`. A distinct database
password remains a supported fallback and does not enable JIT mode.

The `renew-database-access.yml` workflow runs monthly from `prod` and extends
only the existing `postgres` mapping to 89 days. It discovers the PAT owner's
user id from Supabase, preserves branch and network restrictions, and fails if
the expected role or response contract is missing. Run it manually with
`npm run database-access:renew` when validating credential changes.

Runtime credentials remain only in the matching Supabase project. Manifests
contain names, never values.

## Branch Flow

Feature branches start from `dev`. A merge to `dev` validates and deploys that
exact commit to the development project. Production requires an approved open
PR from `dev` to `prod`; the promotion workflow fast-forwards `prod` to the
exact `dev` SHA. The production deploy refuses any other commit.

## Hosted Controls

GitHub environments restrict `dev` deployments to `dev`, `prod` deployments
to `prod`, and `prod-promotion` runs to `dev`. Supabase remains connected to
GitHub for visibility, with its production deployment and automatic branching
toggles disabled.

GitHub does not enforce branch rules or environment reviewers for this private
personal-account repository. The promotion workflow still requires an approved
`dev`-to-`prod` PR and an exact SHA. Native hosted enforcement requires moving
the repository to an organization with GitHub Team or Enterprise.

## Inventory And Retirement

Every active hosted function must be manifest-owned. A stale function is
temporarily allowed only by an unexpired file under `retirements/`. Removal is
explicit and manual after caller verification. The orchestrator never prunes.

## Migrations

Files already present on `prod` are immutable. A new migration begins with:

```sql
-- service-owner: <service-key>
```

Create migrations with the pinned Supabase CLI. Schema ownership changes and
cross-service changes require an accepted ADR before the migration is added.
