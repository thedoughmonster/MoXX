# Development Execution Handoffs

Use the smallest context that can execute the change correctly.

## Routine changes

A small, well-scoped fix stays with one owning agent from inspection through
testing and review. Do not create a plan artifact or a replacement agent when
the current context is short, accurate, and directly useful.

## Complex or context-heavy changes

For a multi-step, ambiguous, high-risk, or context-polluted change, the planning
agent produces one complete but compact execution packet, then hands
implementation to one fresh executor with no inherited conversation transcript.
A Codex Handoff or fork preserves chat history and is not a fresh-context
handoff; use a new task or an unforked subagent.

The execution packet contains only:

- owning issue, goal, and user-visible done state
- exact repository, base ref, branch/worktree, and current-state evidence
- accepted decisions, constraints, exclusions, and non-goals
- relevant files, contracts, upstream version evidence, and known failure
- implementation sequence and unresolved questions
- focused checks, full check, acceptance evidence, and rollback
- hard stops that require returning to the planner or user

The executor reads applicable repository instructions and the named source
files directly. It does not receive planning chatter, discarded alternatives,
raw logs, or unrelated project history.

## Ownership and return

The fresh executor owns implementation, focused tests, the required full check,
and one final semantic review. It does not spawn more agents unless independent
parallel work materially saves time and the prompt explicitly allows it.

Return one compact receipt: changed behavior, commit/diff identity, checks,
acceptance, issue disposition, and real follow-ups. Reopen planning only for a
material scope, architecture, safety, or authority change—not benign drift.
