# MOX-384 execution plan

## Outcome

Deliver one product repository, one stock Symphony scheduler, and one external
watchdog without deleting or rewriting any existing authority during the
cutover.

The target boundaries are:

- `thedoughmonster/MoXX`
  - `MoXi/`: UI and browser presentation
  - `MoMi/`: backend services, migrations, and contracts
- `thedoughmonster/openai-symphony`
  - upstream-stock Elixir scheduler
  - VPS deployment configuration and `WORKFLOW.md`
- `thedoughmonster/symphony-watchdog`
  - token and turn accounting
  - Linear availability circuit
  - Parked and Blocked queue policy
  - admission decisions and dashboard events

Linear umbrella: [MOX-384](https://linear.app/moxx-workboard/issue/MOX-384)

## Current state

- `openai-symphony.service` is intentionally inactive. Do not restart it before
  MOX-394.
- The committed Symphony Elixir tree is identical to upstream. Only the dirty
  working tree contains application customizations.
- The dirty Elixir rollback is incomplete and is not a buildable source state.
- A local MoXX draft exists at `/home/ubuntu/MoXX`.
- Full source histories have been imported without squashing.
- The local watchdog foundation exists at `/home/ubuntu/symphony-watchdog` and
  passes its typecheck, fixtures, lease, and loopback health smoke tests.
- The original MoMi and MoXi repositories have not been modified.
- The MoXX GitHub repository does not yet exist.
- GitHub SSH access works when the real host SSH client is selected explicitly.
  The global Git setting still points to the absent
  `/opt/agent-tools/bin/ssh`.
- GitHub CLI authentication is invalid and must be renewed before remote
  creation or repository-setting changes.

## Native dependency graph

```text
MOX-384
├── MOX-386  MoXX monorepo
│   └── MOX-391 → MOX-388 → MOX-389 → MOX-392 → MOX-390
├── MOX-385  Stock Symphony Elixir
│   └── MOX-393 → MOX-396 → MOX-395 ───────────────┐
└── MOX-387  External watchdog                     │
    └── MOX-397 → MOX-405 ┬→ MOX-403 → MOX-398 ─┐ │
                           └→ MOX-402 → MOX-399 ─┼→ MOX-400
                                             MOX-402 ┘      │
                                        MOX-403 ────────────┼→ MOX-404
                                                           └→ MOX-401

MOX-392 + MOX-395 + MOX-401 → MOX-394 integrated canary
```

MOX-391, MOX-393, and MOX-397 are Done. Remaining implementation leaves are in
Todo, and native blockers prevent later leaves from being mistaken for ready
work. None has `ready-package`.

## Workstream A: MoXX monorepo

Parent: [MOX-386](https://linear.app/moxx-workboard/issue/MOX-386)

1. [MOX-391](https://linear.app/moxx-workboard/issue/MOX-391) imports and
   verifies full source histories. The local import and tree verification are
   already complete; its manifest is in `repository-migration-manifest.md`.
2. [MOX-388](https://linear.app/moxx-workboard/issue/MOX-388) makes root CI,
   hooks, Dependabot, governance, and deployment path routing monorepo-aware.
3. [MOX-389](https://linear.app/moxx-workboard/issue/MOX-389) runs both
   authoritative product validations and deployment dry-runs.
4. [MOX-392](https://linear.app/moxx-workboard/issue/MOX-392) creates the
   private remote, protects `dev` and `prod`, fixes host Git transport outside
   application code, and updates repository mappings while Symphony is stopped.
5. [MOX-390](https://linear.app/moxx-workboard/issue/MOX-390) inventories and
   dispositions active source-repository work before adding reversible
   tombstones. It deletes nothing.

Branch policy:

- `dev` is the development and agent base.
- `prod` retains guarded production promotion.
- MoXi preview deploys from `dev`; MoXi production deploys from `prod`.
- MoMi retains its existing exact-receipt release rules inside `MoMi/`.
- UI and backend changes remain independently reviewable.

## Workstream B: stock Symphony Elixir

Parent: [MOX-385](https://linear.app/moxx-workboard/issue/MOX-385)

1. [MOX-393](https://linear.app/moxx-workboard/issue/MOX-393) creates a
   hash-verified, secret-free recovery package for the dirty Elixir tree.
2. [MOX-396](https://linear.app/moxx-workboard/issue/MOX-396) restores only
   `elixir/` from committed stock and proves non-Elixir files are unchanged.
   It requires explicit operator authorization even though MOX-393 is Done.
3. [MOX-395](https://linear.app/moxx-workboard/issue/MOX-395) builds and tests
   stock Elixir and verifies the VPS service boundary while the service remains
   stopped.
4. [MOX-394](https://linear.app/moxx-workboard/issue/MOX-394) is the only leaf
   allowed to restart Symphony. It joins stock Elixir, MoXX mapping, and the
   proven watchdog in one controlled canary.

The rollback must never use a repository-wide reset, clean, or stash. The
isolated `CODEX_HOME`, workflow, service drop-ins, environment files, and
external monitor stay outside the Elixir restoration.

## Workstream C: external watchdog

Parent: [MOX-387](https://linear.app/moxx-workboard/issue/MOX-387)

1. [MOX-397](https://linear.app/moxx-workboard/issue/MOX-397) creates the Node
   24/TypeScript runtime and transactional SQLite ledger. The clean local
   foundation is complete at commit `916eb91`.
2. [MOX-405](https://linear.app/moxx-workboard/issue/MOX-405) publishes that
   exact foundation to a private, protected remote and adds required CI. It
   does not install or activate the runtime.
3. [MOX-403](https://linear.app/moxx-workboard/issue/MOX-403) ingests only the
   isolated Symphony Codex JSONL and calculates cumulative usage and velocity.
4. [MOX-398](https://linear.app/moxx-workboard/issue/MOX-398) evaluates token
   and turn budgets and authorized `/budget` overrides without resetting usage.
5. [MOX-402](https://linear.app/moxx-workboard/issue/MOX-402) receives verified
   Linear webhooks and owns the crash-safe mutation outbox.
6. [MOX-399](https://linear.app/moxx-workboard/issue/MOX-399) implements the
   one-minute quota circuit, GraphQL `RATELIMITED` handling, and least-privilege
   graceful stop of only `openai-symphony.service`.
7. [MOX-400](https://linear.app/moxx-workboard/issue/MOX-400) adds Parked and
   Blocked transitions plus the fail-closed local admission hook.
8. [MOX-404](https://linear.app/moxx-workboard/issue/MOX-404) moves worker,
   model, reasoning, token, turn, hierarchy, review, and circuit events into the
   actual dashboard issue rows through a watchdog WebSocket.
9. [MOX-401](https://linear.app/moxx-workboard/issue/MOX-401) proves all
   control paths with fixtures and a contained watchdog canary without starting
   Symphony.

SQLite is authoritative for run accounting, cursors, budgets, overrides,
pause state, control actions, and pending Linear projections. Linear remains
the human workflow and projection surface.

## Execution waves

### Wave 1: safe foundations

Run independently:

- MOX-391: repository-history verification
- MOX-393: dirty-Elixir recovery package
- MOX-397: watchdog repository and database foundation

### Wave 2: local implementation

- MOX-388 after MOX-391
- MOX-396 after MOX-393 and explicit operator authorization
- MOX-405 after MOX-397

### Wave 3: policy and validation

- MOX-389 after MOX-388
- MOX-395 after MOX-396
- MOX-403 and MOX-402 after MOX-405
- MOX-398 after MOX-403
- MOX-399 after MOX-402

### Wave 4: integrations

- MOX-392 after MOX-389
- MOX-400 after MOX-398, MOX-399, and MOX-402
- MOX-404 after MOX-400 and MOX-403

### Wave 5: proof and cutover

- MOX-401 after MOX-404
- MOX-394 after MOX-392, MOX-395, and MOX-401
- MOX-390 after MOX-392 and after the operator accepts the integrated evidence

## Manual execution contract

These issues do not depend on Symphony dispatch. A human or manually started
agent can execute a leaf by:

1. Reading the leaf, its parent, and every native blocker.
2. Confirming blockers are Done and the named repository/base commit is still
   current.
3. Creating one isolated feature branch or worktree for the leaf.
4. Preserving every non-goal and rollback boundary from the issue.
5. Linking the exact commit/PR, validation receipt, and operational evidence.
6. Marking the leaf Done only when every acceptance criterion is directly
   evidenced.

No agent should infer permission to deploy, restart Symphony, create provider
secrets, or tombstone repositories from a neighboring issue.

## Recovery boundaries

- Repository consolidation is reversible until source tombstones are applied;
  even then, no source history is deleted.
- Elixir restoration is reversible from the audit package in an isolated
  checkout, not by re-dirtying the service worktree.
- Watchdog derived state is replayable from immutable JSONL and the Linear
  delivery/outbox ledger.
- Linear outages close local admission first. If Linear cannot accept Parked or
  Blocked changes, the quota circuit stops Symphony gracefully.
- Authentication failures never trigger automatic restart.
