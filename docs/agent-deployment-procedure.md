# Agent Deployment Procedure

Use this path for every hosted change. A permission failure is a routing signal,
not a reason to try more publishers.

## Preflight

1. Read root and affected service instructions and manifests.
2. Confirm Node 24, a clean worktree, and a branch based on current `origin/dev`.
3. Run `pnpm run check -- --service <key|all>`.
4. Review changed files, hosted inventory impact, migrations, and retirements.
5. Keep secrets out of commands, logs, commits, manifests, and release records.

## Publish To Dev

1. Commit one intentional change on a feature branch.
2. Use normal Git for ordinary files. When `.github/workflows/` changes, publish
   through the connected GitHub app because cached OAuth credentials may lack
   GitHub's separate workflow permission.
3. Open a feature-to-`dev` PR with verification evidence.
4. Wait for validation, merge through GitHub, and record the resulting `dev` SHA.
5. Confirm the GitHub `Deploy development` run used that exact SHA.

Do not deploy an Edge Function with the Supabase plugin, CLI, dashboard, or a
local script. A push to `dev` is the only normal development deployment trigger.

## Promote To Prod

1. Open one ready `dev`-to-`prod` PR and wait for validation.
2. Dispatch `Promote development to production` with the exact current `dev` SHA.
3. Let that workflow verify the PR, SHA, and ancestry and fast-forward `prod`.
4. Confirm `Deploy production` completed for the same SHA.

Never merge or push `prod` directly. Never use a second function publisher when
GitHub is delayed or rejects a run.

## Database Changes

Automated database apply is paused. For reviewed migrations only:

1. Compare local files with hosted migration history in both environments.
2. Apply SQL in order through the Supabase plugin, dev before prod.
3. Record the plugin-assigned hosted versions; it cannot preserve file timestamps.
4. Verify affected views, triggers, grants, work rows, and idempotency with SQL.
5. Run Supabase security and performance advisors after DDL.

The plugin may administer schema and environment configuration. It may never
deploy repository Edge Functions.

## Hosted Proof

1. Reconcile active functions and unexpired retirements against manifests.
2. Run probes and inspect recent errors.
3. Use one controlled event to prove durable storage, work creation, toggles,
   idempotency, source-neutral formatting, and destination delivery.
4. Confirm no forbidden source API call or duplicate delivery occurred.
5. Finish with a clean worktree and report commit, PR, workflow, migration, and
   hosted behavior evidence.

## Failure Routing

- Workflow-file push rejected for missing workflow scope: use the GitHub app.
- GitHub check failed: inspect that run, fix once, and republish through a PR.
- Supabase migration failed: stop, inspect schema and logs, then add a correction;
  never edit an applied migration.
- Hosted behavior failed: stop promotion, preserve durable evidence, and diagnose
  the owning service. Do not retry through a different deployment authority.
