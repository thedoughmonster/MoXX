---
name: momi-execution
description: Run one authorized MoMi task through implementation, review, validation, and requested delivery evidence.
---

# MoMi Execution

Treat the authorized task and PR evidence as the record of scope, decisions,
and delivery state, GitHub as the branch, CI, review, merge, and release evidence
authority, and this repository as technical truth. No external work tracker is
required. Own one bounded implementation task through
the delivery stage the user requested. A human retains planning, material
architecture decisions, production authority, and any merge decision not
explicitly delegated.

## Establish the work

1. Read the user's task and relevant approved decisions. Do not require Linear
   access, create a tracker issue, or infer a queue of neighboring work.
2. Resolve the assigned scope and owner. If material ambiguity remains, ask for
   the missing decision while continuing independent authorized work.
3. Read the task's dependencies, blockers, acceptance criteria, and relevant
   repository evidence. Preserve historical issue links as audit references.
4. State the outcome, acceptance criteria, expected paths or owning services,
   exclusions, and material stop conditions. Resolve scope conflicts with the
   user before dependent implementation; record decisions in the task or PR.
5. Read every applicable `AGENTS.md`, implicated contract and test, plus
   `docs/agent-deployment-procedure.md`. Inspect status, the current branch,
   `origin/dev`, and the repository-native impact plan.
6. Verify Node `24.14.x` and pnpm `11.7.x`. Verify shell Git remote access and
   GitHub CLI authentication when the requested delivery stage needs them.
7. Work only on an isolated feature branch from current `origin/dev`; never
   dirty `dev`. Record implementation progress in the task or PR.

## Implement the bounded change

Use `develop-repository-change` for the inner code-and-test loop while this
skill owns the requested task-to-delivery lifecycle.

- Reproduce or establish current behavior, then make the smallest coherent
  implementation for the task.
- Use manifests, `AGENTS.md`, ADRs, and impact tooling for ownership and
  architecture. Do not invent another service inventory or validation layer.
- Include committed, modified, and untracked paths in scope decisions. Compare
  actual impact with the task's expected owners and services.
- Run narrow task-relevant tests while iterating. Diagnose observed failures
  before changing code; do not absorb unrelated cleanup.
- Stop for ambiguous ownership, an unexpected service/function or public
  contract, cross-service impact, material security/privacy/cost/exposure,
  destructive migration, production infrastructure, or scope expansion.
- Keep task or PR updates concise: implementation start, published PR, genuine
  block, merge, release, or final requested evidence.

## Publish and validate

1. Inspect status and the full changed-path set against `origin/dev`; confirm
   every untracked path and actual impact belongs to the authorized task. Run the
   repository impact plan when useful for the human-readable scope decision.
2. Perform one final principal-level diff review and commit it. Run focused
   checks on that exact tree. Do not duplicate the authoritative PR final gate
   locally when repository policy assigns it to CI.
3. When authorized, push the feature branch and open one draft PR to `dev`.
   Include task scope, decisions, and validation evidence. No external tracker
   issue or exact disposition metadata is required.
4. Confirm the PR head equals the pushed commit. Wait for the authoritative
   `validate-final` job and inspect any actual failure. Repair only failures
   that belong to the task.
5. Record the PR link in the task. Sweep conversation comments, reviews,
   and unresolved review threads; fix blocking findings and wait for updated
   checks when the head changes.
6. Do not merge unless the user explicitly requested it. When merge is in
   scope, require a green exact head, mergeability, and no blocking feedback;
   then record the merge evidence in the task or PR.
7. For explicitly requested hosted development delivery, use the repository's
   receipt-bound release procedure and verify one controlled acceptance event.
   Never promote to production without explicit authority.
8. Record the PR, commit, validation, and acceptance evidence produced by the
   requested delivery stage in the task or PR. Do not select neighboring work.
