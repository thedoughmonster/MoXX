# Symphony execution boundary

## Ownership

Linear project membership is the admission boundary for the stock Symphony
instance that executes work in `thedoughmonster/MoXX`. This repository records
the cross-product contract; the deployed scheduler configuration remains owned
by `/home/ubuntu/symphony/WORKFLOW.md`.

The canonical execution project is `Symphony Execution`, with ID
`b32e8427-1378-4c1c-81f9-8ca5193b5191` and URL slug
`symphony-execution-d6f95c4b712e`. Only issues in that exact project can be
observed or dispatched by this Symphony instance. Product planning projects
for MoXi and MoMi remain outside the execution boundary.

## Scheduling contract

- The configured repository is `thedoughmonster/MoXX`.
- `required_labels` is empty. Labels such as `moxx` and `ready-package` are
  communicative metadata and never grant execution authority.
- Active states are `Todo`, `In Progress`, `Review`, `Merging`, and `Rework`.
  `Concept` and `Refinement` are not executable states.
- A `Todo` issue with any unfinished native Linear blocker is visible inside
  the execution project but is not dispatchable.
- Eligible issues are ordered by Symphony priority, then creation time, then
  identifier. Visual board position is not an execution-order input.
- Moving an active issue outside the configured project can stop its worker
  during normal running-state reconciliation. This does not by itself justify
  restoring a broader planning-project scope.

Project membership is intentionally narrow. Planning parents, milestones, and
non-admitted work stay in their meaningful planning projects; only executable
leaves admitted to this Symphony instance belong in `Symphony Execution`.

## Change and rollback rules

Changes to the canonical project, active states, label gate, repository, or
polling behavior require an explicitly authorized cutover issue. Apply workflow
changes by normal hot reload without restarting Symphony or manually stopping
workers. Preserve unrelated changes in the Symphony worktree.

Rollback is warranted only when the exact execution project cannot discover or
dispatch eligible admitted work, native blockers fail to suppress dispatch, or
another execution acceptance criterion makes the boundary unusable. A worker
being reconciled out solely because its issue is outside the new scope is an
expected transition, not a rollback trigger.

The live cutover and three-poll runtime evidence are recorded in the persistent
workpads for MOX-419 and MOX-423. Those records, together with the deployed
workflow, are authoritative for operational timestamps, project membership,
worker disposition, and rollback evidence.
