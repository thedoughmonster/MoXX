---
name: momi-execution
description: Run one assigned MoMi Linear issue through the OpenHands execution workflow: establish readiness and repository scope, implement on a feature branch, publish a draft GitHub PR, wait for authoritative CI, hand the issue to human review, and stop. Use when asked to work an assigned Linear issue, use the MoMi execution workflow, or perform MoMi coding work inside OpenHands.
---

# MoMi Execution

Treat OpenHands as the execution harness, Linear as planning and work state,
GitHub as branch/PR/CI state, and this repository as technical truth. Own one
bounded implementation issue. A human retains planning, architecture, review,
merge, deployment, and production authority.

## Establish the work

1. Confirm the native Linear plugin/connector tools are available in the
   session. If authentication or the required read/write tools are absent,
   report that capability separately and stop; do not replace Linear with an
   issue search by age or number. Do not assume an OAuth-backed custom MCP can
   be forwarded through the coding-agent bridge.
2. Resolve the explicitly assigned issue. If assignment is ambiguous, multiple
   eligible issues are assigned, or another implementation issue is already In
   Progress, stop for human selection. Never treat a capped search page as the
   complete queue; use exact filters and follow pagination when enumeration is
   necessary.
3. Read the full issue, project, parent, children relevant to its acceptance,
   blockers and dependencies, priority/order, assignee, and workflow state.
   Verify it is unblocked and in the workspace's Ready/Todo-equivalent state.
4. Identify the linked open GitHub owning issue required by
   `docs/development-issue-ledger.md`. Linear is the planning authority; the
   GitHub issue remains the repository's delivery-ledger key.
5. State the outcome, acceptance criteria, expected paths or owning services,
   exclusions, and material stop conditions. Correct planning drift in Linear
   before implementation; do not create a second scope or ownership model.
6. Read every applicable `AGENTS.md`, the implicated contracts and tests, and
   `docs/agent-deployment-procedure.md`. Inspect `git status`, the current
   branch, `origin/dev`, and the repository-native impact plan.
7. Verify Node `24.14.x`, pnpm `11.7.x`, shell Git remote access, and GitHub CLI
   authentication. Treat the Linear connector, OpenHands GitHub connector, SSH
   Git, and `gh` as separate capabilities: failure of one does not prove
   failure of another.
8. Work only on an isolated feature branch from current `origin/dev`; never
   dirty `dev`. Move the Linear issue to In Progress only after these checks
   show it is eligible.

## Implement the bounded change

Use `develop-repository-change` for the inner code-and-test loop while this
skill owns the outer Linear-to-review lifecycle.

- Reproduce or establish current behavior, then make the smallest coherent
  implementation for this issue.
- Use repository manifests, `AGENTS.md`, ADRs, and impact tooling for ownership
  and architecture. Do not invent `allowed_paths`, a service inventory, or a
  second validation framework.
- Include committed, modified, and untracked paths in every scope decision.
  Compare the actual impact plan with the issue's expected owners and services.
- Run narrow issue-relevant tests while iterating. Diagnose the observed
  failure before changing code; do not absorb unrelated cleanup.
- Stop for ambiguous ownership, an unexpected service/function or public
  contract, cross-service impact, material security/privacy/cost/exposure,
  destructive migration, production infrastructure, or scope expansion.
- Keep Linear updates quiet. Record only a genuine block, implementation start,
  draft PR publication, or review handoff.

## Publish and hand off

1. Inspect `git status --short` and the full changed-path set against
   `origin/dev`; confirm every untracked path and actual impact belongs to the
   issue. Run `pnpm momi-impact plan --base origin/dev --head HEAD` when useful
   for the human-readable scope decision.
2. Run `pnpm momi-check changed`. Fix relevant failures. Do not run the local
   `--final` gate: the PR job named `validate-final` is the one authoritative
   final gate and includes current generated-quality evidence.
3. Review the final diff once, commit, push the feature branch, and open exactly
   one draft PR to `dev`. Its body must contain exactly one of each:

   ```text
   Owning issue: #<open-github-issue-number>
   Disposition: partial|complete
   ```

4. Confirm the draft PR head equals the pushed commit. Wait for GitHub checks;
   require both `validate-final` and the issue-ledger validation to succeed.
   Inspect an actual failure and repair it only when it belongs to this issue.
5. Associate the PR with the Linear issue using the workspace's native
   Linear/GitHub linkage when available; otherwise add one concise PR link.
   After local checks, draft publication, and required CI are green, move the
   Linear issue to the workspace's In Review-equivalent state and record the
   handoff.
6. Stop. Do not mark implementation complete before the OpenHands Stop hook
   allows it. Never make the PR ready, merge, deploy, mutate production, or
   independently select neighboring work.

The Stop hook deterministically enforces the runtime, canonical changed check,
clean pushed branch, draft PR contract, and required CI. Linear readiness,
issue-to-path intent, and the final In Review mutation remain agent-driven
because command hooks cannot call session MCP tools; report any incomplete
handoff instead of claiming success.
