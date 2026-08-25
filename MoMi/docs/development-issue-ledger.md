# Development Issue Ledger

Linear is the sole durable work-item ledger. GitHub owns branches, pull
requests, CI, review history, and deployments, but GitHub Issues are not a
planning, readiness, lifecycle, or completion authority.

## Required PR metadata

Put exactly this line in the PR body:

```text
Owning Linear issue: MOX-109
```

The PR head branch must contain the same single Linear identifier. CI rejects
absent, duplicate, invalid, mismatched, or ambiguous metadata without querying
or mutating GitHub Issues.

## After merge

Attach the PR, merge/release receipt, workflow run, and any disposable
acceptance evidence to the owning Linear issue. Status and completion remain
deliberate Linear actions governed by the issue's live acceptance criteria;
neither a merge nor a green check closes work automatically.
