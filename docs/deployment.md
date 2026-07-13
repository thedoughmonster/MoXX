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

The apply command runs checks, deploys explicit manifest-owned functions with
the pinned CLI and `--use-api`, checks hosted inventory, probes deployed
functions, reads Supabase advisors, and writes a release artifact. It never uses
Docker, `--prune`, or implicit function discovery.

## Credentials

The `dev` and `prod` GitHub environments each store a permanent
`SUPABASE_ACCESS_TOKEN` for Supabase API operations and Edge Function
deployment. Automatic deployments do not request a database password.

Automated remote migration planning and apply are paused. Migration files still
pass ownership, immutability, and architecture checks in GitHub. An intentional
schema change is applied manually with the Supabase plugin after review, then
verified against hosted migration history. Re-enabling automatic apply requires
a healthy non-IPv6 connection and a passing hosted deployment proof.

Temporary database access remains an independent administrator path and cannot
silently change deployment behavior.

Runtime credentials remain in Supabase and deployment credentials remain in
protected GitHub environments. Manifests contain names, never values.

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
