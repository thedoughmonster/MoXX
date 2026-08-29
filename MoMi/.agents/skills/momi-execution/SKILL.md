---
name: momi-execution
description: Run one assigned MoMi Linear issue through implementation, review, validation, and requested delivery evidence.
---

# MoMi Execution

Treat Linear as the sole planning and work-state authority, GitHub as the
branch, PR, CI, review, merge, and release evidence authority, and this
repository as technical truth. Own one bounded implementation issue through
the delivery stage the user requested. A human retains planning, material
architecture decisions, production authority, and any merge decision not
explicitly delegated.

## Establish the work

1. Confirm the native Linear connector can read and update the assigned issue.
   If the required capability is absent, report that blocker; do not substitute
   GitHub issues or another work ledger.
2. Resolve the explicitly assigned issue. If assignment is ambiguous, multiple
   eligible issues are assigned, or another implementation issue is already In
   Progress, stop for human selection. Never infer a queue from a capped search.
3. Read the full issue, project, relevant parent and children, blockers,
   dependencies, priority, assignee, workflow state, and acceptance criteria.
   Verify the issue is eligible and unblocked.
4. State the outcome, acceptance criteria, expected paths or owning services,
   exclusions, and material stop conditions. Correct planning drift in Linear
   before implementation; do not create a second scope or ownership model.
5. Read every applicable `AGENTS.md`, implicated contract and test, plus
   `docs/agent-deployment-procedure.md`. Inspect status, the current branch,
   `origin/dev`, and the repository-native impact plan.
6. Verify Node `24.14.x`, pnpm `11.7.x`, shell Git remote access, and GitHub CLI
   authentication. Treat Linear, SSH Git, and `gh` as separate capabilities.
7. Work only on an isolated feature branch from current `origin/dev`; never
   dirty `dev`. Move the Linear issue to In Progress after eligibility and
   repository preflight are established.

## Implement the bounded change

Use `develop-repository-change` for the inner code-and-test loop while this
skill owns the outer Linear-to-delivery lifecycle.

- Reproduce or establish current behavior, then make the smallest coherent
  implementation for the issue.
- Use manifests, `AGENTS.md`, ADRs, and impact tooling for ownership and
  architecture. Do not invent another service inventory or validation layer.
- Include committed, modified, and untracked paths in scope decisions. Compare
  actual impact with the issue's expected owners and services.
- Run narrow issue-relevant tests while iterating. Diagnose observed failures
  before changing code; do not absorb unrelated cleanup.
- Stop for ambiguous ownership, an unexpected service/function or public
  contract, cross-service impact, material security/privacy/cost/exposure,
  destructive migration, production infrastructure, or scope expansion.
- Keep Linear updates concise: implementation start, published PR, genuine
  block, merge, release, or final requested evidence.

## Publish and validate

1. Inspect status and the full changed-path set against `origin/dev`; confirm
   every untracked path and actual impact belongs to the Linear issue. Run the
   repository impact plan when useful for the human-readable scope decision.
2. Perform one final principal-level diff review and commit it. Run focused
   checks on that exact tree. Do not duplicate the authoritative PR final gate
   locally when repository policy assigns it to CI.
3. Push the feature branch and open exactly one PR to `dev`. Link the Linear
   issue for traceability when available. No parallel GitHub issue or exact
   disposition metadata is required.
4. Confirm the PR head equals the pushed commit. Wait for the authoritative
   `validate-final` job and inspect any actual failure. Repair only failures
   that belong to the issue.
5. Associate the PR with the Linear issue using native linkage when available,
   otherwise add one concise PR link. Sweep conversation comments, reviews,
   and unresolved review threads; fix blocking findings and wait for updated
   checks when the head changes.
6. Do not merge unless the user explicitly requested it. When merge is in
   scope, require a green exact head, mergeability, and no blocking feedback;
   then record the merge evidence in Linear.
7. For explicitly requested hosted development delivery, use the repository's
   receipt-bound release procedure and verify one controlled acceptance event.
   Never promote to production without explicit authority.
8. Update Linear with the PR, commit, validation, and acceptance evidence the
   requested delivery stage produced. Do not select neighboring work.
