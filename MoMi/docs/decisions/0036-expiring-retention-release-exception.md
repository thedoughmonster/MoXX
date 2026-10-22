# 0036: Expiring Exact-Project Retention Release Exception

- Status: proposed; preparation only, unactivated
- Date: 2026-10-22
- Owner: cron-history-governance and repository release tooling

## Context

The thirty-day retention revision is merged, but normal release correctly
rejects unrelated missing production migration versions and an unmatched
development history entry. Neither a green PR nor a retention request grants
permission to deploy that backlog or invent migration history.

Production lacks the governor; development already has its earlier definitions.
The required platform extensions, queues and named Vault dependencies were
verified separately. Those observations expire as evidence and do not replace
the exact execution preflight.

## Proposed Decision

Add one isolated runner under `scripts/release/retention/`, reachable only from
the existing protected `deploy-dev.yml` and `deploy-prod.yml` workflows. Keep
normal planning, migration parity, deployment and receipt acceptance unchanged.
This is not a general migration allowlist or a second deployment authority.

An operator-approved document binds the exact source commit, project, selected
immutable retention SQL, full hosted history and scoped object fingerprints,
preserved unknown/deferred state, and governor payload. Its canonical digest
must equal the protected environment's `MOMI_RETENTION_APPROVAL_SHA256`.
Approval expires within 24 hours and before the runner's fixed absolute sunset.
Approval preparation and PR publication do not populate that variable.

Only the two original August governance migrations and the October retention
revision may execute. Development selects only genuinely missing versions;
existing definitions are verified, not recreated. Production consumes an exact
successful development exception artifact before applying its approved subset.
SQL and genuine migration-history records commit together; unknown history is
preserved without placeholders or claims of complete repository parity.

The same protected workflow may deploy only the approved governor payload.
Installation leaves cleanup disarmed. Activation, rate acceptance, deletion,
credential changes and unrelated deployment are not granted by this exception.

## Authority And Failure Boundaries

Production dispatch runs `deploy-prod.yml` from the exact approved `dev` SHA,
while retaining the protected `prod` environment. This expands both the existing
credential purpose and production branch authority and requires the pending
amendment in `docs/release-credentials.md`. The user must approve both before
configuration, merge or execution. Any needed change to the production
environment's allowed branches requires separate approval; this PR changes none.
No credential is created, inspected or moved while preparing this proposal.

Transactions roll back failed SQL and history inserts together. After a commit,
pause and retain honest evidence; do not delete recorded versions or undo applied
DDL to manufacture a retry baseline. Function recovery uses only a separately
authorized previously verified payload. Removing the approval digest disables
future execution but does not undo an already committed change.

The exact approval, receipt, preflight and recovery requirements are in the
[retention exception procedure](../retention-release-exception.md).
