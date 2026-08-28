# Symphony Execution Project Architecture

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
- `required_labels` is empty. Labels communicate facts only and never grant
  execution authority, request evaluation, or change lifecycle state. The
  obsolete `ready-package` marker is retired and must not be assigned or
  required.
- Active states are `Todo`, `In Progress`, `Review`, `Merging`, and `Rework`.
  `Concept` and `Refinement` are not executable states.
- The normal preliminary lifecycle is `Concept` → `Refinement` → `Todo`.
  `Parked` and `Blocked` remain watchdog-specific exception states rather than
  admission stages.
- A `Todo` issue with any unfinished native Linear blocker is visible inside
  the execution project but is not dispatchable.
- Eligible issues are ordered by Symphony priority, then creation time, then
  identifier. Visual board position is not an execution-order input.
- Moving an active issue outside the configured project can stop its worker
  during normal running-state reconciliation. This does not by itself justify
  restoring a broader planning-project scope.

Project membership is intentionally narrow. A vetted `Todo` issue outside the
execution project is not exposed to this Symphony instance. Planning parents,
milestones, and non-admitted work stay in their meaningful planning projects;
only executable leaves explicitly admitted to this Symphony instance belong in
`Symphony Execution`.

## Lifecycle and admission

- `Concept` contains incomplete, stale, or failed-evaluation work for which no
  execution is requested.
- Entering `Refinement` requests an external, event-driven evaluation outside
  Symphony. A passing evaluation moves the issue to `Todo` while retaining its
  meaningful planning project; a failing evaluation moves it to `Concept` with
  one concise gap comment.
- `Todo` in a meaningful planning project is vetted but waiting. It remains
  outside this Symphony instance.
- Admission is an explicit, controlled project move into `Symphony Execution`.
  The admission handler must re-fetch and revalidate the issue immediately
  before that move. `Todo` in `Symphony Execution` is admitted.
- Unfinished native Linear blockers prevent an admitted `Todo` issue from
  dispatching. Native parent/sub-issue, related, duplicate, and blocker
  relations remain authoritative. Only native hierarchy and blockers form the
  durable dependency structure; related-work labels are search hints only.
- `Parked` and `Blocked` remain watchdog exception states, not normal admission
  or execution lanes.
- `Ready` and `ready-package` are obsolete and must not be used as holding,
  admission, or dispatch contracts.

Material changes to any vetted `Todo` issue, including an admitted issue, can
invalidate it. An admitted issue must leave `Symphony Execution` and return to
its meaningful planning project before entering `Refinement`. Any later
admission is a new controlled project move with fresh revalidation. No
lifecycle, admission, or execution state may change solely because a label was
added or removed.

## Executable leaf types

Code-changing leaves follow implementation, pull request, independent review,
and merge. Read-only planning or evidence leaves may complete directly after
producing and validating their explicitly required artifact when no
code-changing pull-request route applies. Uniformity alone must not force a
read-only leaf through the code-change lifecycle.

## Change and rollback rules

Changes to the canonical project, active states, label semantics, repository, or
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
