# Development Issue Ledger

GitHub issues are the durable project ledger. Every development PR has exactly
one open owning issue.

## Required PR metadata

Put exactly these lines in the PR body:

```text
Owning issue: #109
Disposition: partial
```

Use `partial` when accepted scope or live acceptance remains. Use `complete`
only when all remaining acceptance is satisfied. CI rejects absent, duplicate,
invalid, closed, or pull-request targets.

## After merge

The privileged ledger job never checks out or executes PR code. It parses only
PR metadata, writes one marker-bound delivery comment, and reconciles
idempotently: reruns update no duplicate state. `partial` leaves the issue open;
`complete` closes it. Production promotion is not a second delivery.

Do not mark an issue complete merely because validation passed. Record the PR,
merge/release receipt, workflow run, and any disposable acceptance evidence in
the owning issue before completion.
