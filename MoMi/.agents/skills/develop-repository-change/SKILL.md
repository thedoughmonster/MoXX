---
name: develop-repository-change
description: Implement, fix, refactor, test, review, and release changes in an existing repository with one owning Codex agent and minimal ceremony. Use for ordinary feature work and bug fixes when Codex should follow repository instructions, make the smallest coherent patch, run focused checks, perform one final review, and escalate only material architecture or safety decisions.
---

# Develop Repository Change

Own the change from inspection through a reviewable result. Keep repository law
and deterministic checks authoritative; do not create role ceremony around them.

## Establish the task

1. Read the applicable `AGENTS.md` files and the code, contracts, and tests
   directly implicated by the request.
2. Bind the change to exactly one Linear issue. Use Linear as the work-state
   authority and GitHub only for code, CI, review, merge, and release evidence.
3. State the outcome, acceptance evidence, material constraints, and exclusions.
   Resolve minor ambiguity with a reasonable documented assumption.
4. Work from current repository state on a feature branch or isolated worktree.
   Preserve unrelated user changes.

Use plan mode only when dependency ordering or a material user decision is
unclear. Keep routine work with this one owner. Use additional agents only when
the user explicitly requests parallel work or a bounded independent check.

## Escalate only when necessary

Continue with the normal loop unless the change introduces or materially alters:

- a service, repository, host, dataset owner, or cross-service/public contract;
- authentication, authorization, secret custody, privacy, billing, or exposure;
- a destructive or difficult-to-reverse migration;
- production infrastructure, provider control-plane state, or recovery policy;
- conflicting repository law that cannot be resolved from current evidence.

Pause and ask the user only when one of these material boundaries is genuinely
unresolved. Use a specialized operational skill only when the requested action
actually requires it. Do not create role agents, readiness packets, or repeated
approval layers merely to restate repository rules or rerun checks.

## Implement and verify

1. Reproduce the bug or establish the current behavior when applicable.
2. Implement the smallest coherent change. Update contracts and tests when the
   externally observable behavior changes.
3. Run the narrowest relevant tests while iterating.
4. Run the repository-required full check once when the patch is complete.
   Rerun it only after a material correction or when local and CI results differ.
5. Review the final diff once for correctness, regressions, security, data
   boundaries, and compliance with applicable `AGENTS.md` files.

Leave formatting, linting, type checks, generated-file checks, and other
deterministic rules to their scripts and CI. Do not manually re-audit a passing
mechanical result.

## Handle findings without loops

Classify each finding:

- `BLOCKING`: correctness, security, privacy, data integrity, accepted contract,
  deployability, or explicitly required acceptance is broken.
- `FIX_NOW`: a small, clearly beneficial correction inside the approved scope.
- `FOLLOW_UP`: real but nonblocking work outside the smallest complete change.
- `NO_ACTION`: stylistic, speculative, already mitigated, or inconsequential.

Fix `BLOCKING` findings and normally fix `FIX_NOW` findings. Report the others and
continue. Do not stop for benign drift. After one correction pass, escalate only
if a material blocker remains; do not commission repeated opinion reviews.

## Finish

Before release, update the Linear issue with the delivery state and evidence
appropriate to the accepted scope. Record discovered follow-up work in that
issue or one linked Linear issue rather than leaving it only in the final
response. Link the Linear issue from the PR when useful for traceability; do not
create or require a duplicate GitHub issue ledger.

Commit and publish only when requested or required by the repository workflow.
Use the repository's declared release command for hosted changes. Report the
changed behavior, checks run, acceptance result, remaining follow-ups, and any
rollback or recovery state. Do not claim completion before required checks pass.
