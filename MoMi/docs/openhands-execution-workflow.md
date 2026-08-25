# OpenHands Execution Workflow

Use OpenHands as MoMi's execution harness for one assigned implementation
issue. The normal starting prompt is:

```text
Work the assigned Linear issue using the MoMi execution workflow.
```

## Responsibilities

- Linear owns human-visible planning: projects, hierarchy, dependencies,
  priority/order, readiness, assignment, execution status, and review state.
- OpenHands loads repository context and `momi-execution`, prepares the runtime,
  exposes integrations, hosts the coding agent, and applies the Stop hook.
- The coding agent implements one bounded issue, tests it, diagnoses failures,
  resolves review feedback, and owns its validated merge to `dev`.
- GitHub owns branches, commits, PRs, authoritative CI, review history, and
  deployments. Linear remains the sole work-item and lifecycle authority.
- Repository manifests, ADRs, `AGENTS.md`, impact tooling, validators, and CI are
  the technical authority.
- Humans retain planning, material architecture decisions, production mutation,
  and approval of material workflow changes.

## Start a task

1. Start a fresh OpenHands conversation against `momi-backend` with the prompt
   above. The Node-pinned Agent Canvas runtime supplies Node 24.14.x; repository
   setup verifies it, pins pnpm 11.7.x, installs locked dependencies, and
   prints a capability-only preflight.
2. The `momi-execution` skill resolves the assigned Linear issue and reads its
   complete project, parent, dependency, priority, assignment, and status
   context. It must not infer an exhaustive queue from a capped issue search.
3. The agent verifies readiness, the owning Linear issue, applicable
   repository governance, expected impact, acceptance, exclusions, current
   `origin/dev`, and an isolated feature branch.
4. Linear moves to In Progress only when the issue is selected, eligible, and
   unblocked. If more than one issue is plausible, a human selects the work.

## Implement and finish

The agent uses repository-native ownership and impact mechanisms, includes
untracked paths in scope reasoning, and runs narrow tests while iterating. It
stops for ownership ambiguity, unexpected cross-service/public-contract impact,
scope expansion, or a material security, privacy, cost, exposure, destructive
migration, production, or architecture decision.

Before completion it must:

1. compare actual changed and untracked paths with the issue and impact plan;
2. perform one final principal-level diff review and commit it;
3. run `pnpm momi-check changed` on that exact commit, then push the clean
   feature branch;
4. publish one draft PR to `dev` with exactly one
   `Owning Linear issue: MOX-<number>` line matching the head branch;
5. wait for `validate-final` and Linear issue-mapping validation to succeed;
6. associate the PR with Linear and sweep all PR feedback;
7. when no blocking feedback remains, move Linear to Merging, mark the PR ready,
   merge it to `dev`, and verify the merge commit is present on `origin/dev`;
8. for hosted scope, release the exact validation receipt to development and
   verify one controlled acceptance event before stopping.

The PR `validate-final` job is the authoritative final gate; do not duplicate
it locally. It selects the correct full or path-scoped checks and verifies
current generated quality evidence. The OpenHands Stop hook blocks completion
for the wrong Node version, failed canonical changed check, uncommitted or
untracked files, a mismatched PR head, an unmerged PR, unresolved review
threads, invalid metadata, inconsistent issue disposition, or failed/missing
required CI.

## Authentication and capabilities

These capabilities are independent and must be reported separately:

- The native Linear plugin supplies planning reads and writes. Agent Canvas
  can enumerate an OAuth-backed custom MCP but its current ACP bridge cannot
  forward that credential, so the custom MCP is not the execution path.
- OpenHands GitHub MCP authentication is optional when its capabilities are
  covered by shell Git and `gh`.
- SSH Git supplies repository fetch and push in the OpenHands workspace.
- GitHub CLI authentication supplies PR, review, merge, and CI operations.
- An unauthenticated `gh` does not mean shell Git is unavailable.

No credential belongs in this repository or in task output. Reauthenticate the
failed capability through its supported UI or CLI without repurposing a token
from another capability.

## Native limitations

- The shell Stop hook cannot inspect session MCP tools, compare free-form Linear
  acceptance text to paths, or mutate Linear. The skill performs those steps,
  and the agent must report missing Merging or merge evidence instead of
  claiming completion.
- Concurrency one is operationally enforced by explicit assignment, Linear
  status, and the skill; there is no distributed lock.
- Linear remains beside OpenHands rather than embedded as a planning dashboard.
- Starting a run, review, merge, and validated development release are
  agent-controlled. Production promotion remains intentionally human-controlled.
