# 0006: Use GitHub As The Only Deployment Authority

- Status: accepted
- Date: 2026-07-14
- Amendment: ADR `0008` supersedes the migration pause and development
  push-event requirement below.
- Amendment: 2026-07-23; deployment dispatch is bound to an exact validated
  plan/tree and only manifest-owned affected functions are selected.

## Context

The same `dev` commit was deployed once by GitHub Actions and once by Supabase's
Git-connected persistent branch. Both deployments succeeded, but two writers
make release identity, ordering, audit history, and rollback ambiguous.

## Decision

GitHub Actions is the sole authority for deploying repository code and Edge
Functions to development or production.

Only `.github/workflows/deploy-dev.yml` and `deploy-prod.yml` may invoke
`npm run deploy:apply`. The apply entry point must reject local execution,
non-dispatch events, the wrong Git ref, any other workflow file, an invalid
plan/tree identity, or an empty/unknown affected-service list.

Supabase's GitHub deployment integration must remain disabled. A Supabase
branch must not be Git-synced. Reconnecting either path requires a superseding
ADR and the user's explicit approval.

Automated database migration apply remains paused under the existing decision.
The reviewed Supabase plugin path is temporary schema administration, not a
repository deployment path, and it may never deploy Edge Functions.

This decision supersedes the deployment-authority paragraph in ADR `0005`.

## Consequences

- Every repository deployment has one GitHub commit, workflow run, and release
  artifact.
- Repository-only releases have zero Edge Function deployments; service
  releases deploy only functions owned by impact-selected manifests.
- Protected GitHub environments remain the only holders of deployment tokens.
- Developers and agents may run checks and deployment plans locally, but never
  deployment apply.
- A second deployer is an architecture violation and must fail repository
  checks before merge.
