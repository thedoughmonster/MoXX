# Development Issue Ledger

GitHub issues are the durable project ledger. A merged pull request is delivery
evidence, not a substitute for updating its owning issue.

## Before implementation

Every change has exactly one open owning issue. Update an existing issue when
the work is already in its accepted scope. Create a linked issue only for a
distinct outcome; do not duplicate the same plan across issues.

Record new plans, material follow-ups, and deferred work in the owning issue or
a linked follow-up issue before finishing the development turn.

## Required delivery metadata

Put exactly these lines in the development PR body:

```text
Owning issue: #109
Disposition: partial
```

Use `partial` when any accepted issue scope remains after the PR. Use
`complete` only when the issue's remaining acceptance criteria are satisfied.

The release coordinator creates a minimal PR body. For that path, put the same
two lines in the final commit message instead:

```text
Owning issue: #109
Disposition: complete
```

CI rejects missing, duplicate, closed, or invalid owning issues and any
disposition other than `partial` or `complete`.

## After merge

The issue-ledger workflow writes one idempotent delivery comment containing the
merged PR, merge commit, and disposition. A `partial` delivery leaves the issue
open. A `complete` delivery closes it. Production promotion is not a second
delivery and does not repeat this process.

Do not mark an issue complete because CI passed. Completion means its accepted
outcome and remaining acceptance criteria are actually satisfied.
