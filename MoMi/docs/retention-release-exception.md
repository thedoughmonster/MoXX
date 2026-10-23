# Retention Release Exception

Status: proposed, unactivated. Preparation permits a reviewed PR only. The user
must separately approve the expanded production credential purpose and exact
execution scope before configuration, merge or deployment. Normal release
requirements remain the default; this document grants no live operation.

## Exact Scope

Use only `thedoughmonster/MoXX` and the existing protected deployment workflows.
Development is `xtbraqnlskmqxinjxxdn`; production is `viodfldzuoypnpqaagag`.
The sole function is `momi-cron-history-governor-v1`, owned by
`cron-history-governance`. No retirement, pruning, other function, history
placeholder, unrelated migration, retention activation or data deletion belongs
to this release exception.

The only selectable source files are:

- `20260805081324_govern_cron_history_retention_trigger_adapter.sql`
- `20260805122000_derive_cron_history_provider_warning.sql`
- `20261022172534_configure_thirty_day_cron_history_retention.sql`

The runner requires exactly the October version in development and all three
versions in production, each genuinely missing. Development's existing governance
objects must match their accepted definitions before selecting the October
revision. Existing objects without a corresponding history entry are a stop,
not permission to replay their CREATE statements or mark them applied.

## Approval And Workflow Gates

Use a strictly validated, bounded approval document. It binds `source_sha`,
environment/project, issue and expiry times, validation run/head/receipt digest,
`before` ledger/object/function digests and complete sorted `versions`,
`function_source_sha256`, exact `migrations`, sorted `deferred_versions`,
`dev_receipt`, and `metrics_secret_attestation`. Unknown hosted versions remain
in the full before inventory;
deferred versions are local versions absent from that inventory and this release.
Selected SQL bytes must match immutable hashes in the source-pinned runner.
The authenticated validation receipt must have the same full Git tree as the
approved source; a squash merge may have a different SHA from its validated PR.
The fingerprint covers definitions, grants, triggers, indexes, constraints,
RLS and the governor schedule; a function-body match alone is insufficient.
No approval field supplies arbitrary SQL, shell, file paths or deploy targets.

Require the canonical document digest to equal the protected environment
variable `MOMI_RETENTION_APPROVAL_SHA256`. Reject missing or malformed digests,
unknown fields, target drift, future-issued or expired approvals, duration over
24 hours, and the fixed absolute sunset. Recheck expiry before every mutation.
Do not add a flag or environment variable that bypasses these checks.

Require the exact repository, `workflow_dispatch`, workflow path, approved `dev`
SHA/tree, protected environment and concurrency checks. Production deliberately
dispatches from `dev` with the protected `prod` environment. This proposed change
to production credential branch authority needs explicit approval; verify that
environment's branch eligibility and obtain separate approval for any necessary
settings change. The PR changes no protected environment settings. Read JSON through an
environment value or file, never shell interpolation. Validate it before the
step receiving Supabase credentials. Normal apply and exception apply are
mutually exclusive; conflicting normal inputs must fail. Artifact verification
needs only `actions: read`; the runner cannot modify its approval variable.

## Owner Names-Only Attestation

Each approval requires `metrics_secret_attestation` with exactly these fields:

- `environment` and `project_ref`: the approval's exact target.
- `name`: `MOMI_CRON_HISTORY_METRICS_SECRET_KEY`; `present`: `true`.
- `owner`: `Zac`; `method`: `owner_dashboard_names_only`.
- `observed_at`: a strict UTC ISO timestamp ending in `Z`.

Create this record only after Zac actually confirms the name in the selected
project's dashboard, following the [names-only guide](supabase-edge-function-secrets.md).
This document supplies no live attestation. Never infer one from prior evidence
or a GET response. No value, digest, length or other key metadata field is allowed;
do not use secrets listings or alternate digest-bearing enumeration.
Observation must be at or before `issued_at`; approval expiry must be no later
than 24 hours after observation. The protected canonical approval digest binds
this record. Recheck its binding and freshness before SQL and function deployment.
The governor's GET checks presence only, not authentication validity; retain the
independent post-deployment configuration/liveness and disarmed-state checks.

## Apply And Evidence

Use the pinned CLI and exact linked project through the approved credential
consumer. Verify dependencies and the full approved before-state immediately
before SQL. Serialize the operation and recheck history inside the transaction.
Execute only the verified source bytes, rejecting transaction-control escapes.
Each executed source and its genuine version/name/source history record belong
to the same transaction. Do not use `ON CONFLICT` to hide contradictory history.

Read back exactly `hosted-before` plus the versions actually applied, verify
their source and governed object fingerprints, and prove preserved unknown and
deferred entries unchanged. Deploy only the approved governor payload through
the existing protected workflow. Verify its configuration/liveness and the
disarmed governor state. No catch-up or automatic cleanup is part of this step.

Emit a distinct `retention_exception_release` receipt only after successful
commit, readback and function verification. Bind source SHA, approval
digest, exact project, selected migration/payload hashes, before/after and
preserved-state fingerprints, deployment readback, workflow/run ID and attempt.
Never label this evidence full repository parity or accept it as an ordinary
release receipt. Retain separately typed failure/partial-progress evidence.

## Development To Production

Development uploads its exception receipt as an immutable workflow artifact.
Development uses `dev_receipt: null`. After development succeeds, issue a separate
production approval whose `dev_receipt` binds `run_id`, `run_attempt`, `artifact_id`
and receipt `sha256`. Verify GitHub's
actual repository, workflow path, branch, head SHA, successful required job/run,
artifact membership and downloaded bytes. Caller-supplied JSON or an artifact
name alone is insufficient. The production payload and selected SQL must match
the accepted development evidence; production prerequisite additions remain
explicit in its own approval. This avoids a circular preapproval of an artifact
that does not yet exist.

## Stop, Retry And Rollback

Missing authority, mismatched evidence, an ambiguous commit or failed readback
stops the operation. Do not fall back to normal `db push`, another publisher,
extra credentials, history repair or a wider migration set.

A failed transaction rolls back its SQL and history together. If SQL committed
before a later failure, retain the actual state and failure receipt and reconcile
it read-only. This one-shot runner cannot resume against already applied selected
versions. Recovery needs separately reviewed authority and an exact approved
repair; a fresh approval alone does not enable a retry.
Do not replay CREATE statements or erase history. Keep the governor disarmed.
Revoke the protected approval digest to prevent another attempt; expiry and
revocation do not interrupt or undo a transaction already in progress.

Code rollback does not reverse committed schema. Any necessary schema correction
is reviewed additive work; any function rollback needs an explicitly authorized
verified payload. Existing credential ownership, immediate revocation, custody
and non-exposure rules remain in force. No runtime secret or provider role is
created or changed by this exception.
