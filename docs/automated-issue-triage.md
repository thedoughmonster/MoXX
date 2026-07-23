# Automated issue triage

`.github/workflows/issue-triage.yml` proposes feature and dependency triage for
each newly opened issue. GitHub runs issue workflows from the default branch,
so the behavior becomes active only after production promotion.

## Authority split

The model job has only `contents: read` and `issues: read`. It receives a sparse,
shallow checkout and a generated JSON snapshot capped at one 12,000-character
body, 20 1,200-character comments, and 50 200-character candidate titles.
Issue text, comments, labels, and repository text are untrusted prompt data.
The official Codex action and CLI are pinned, run read-only, use low effort, and
have a ten-minute job timeout.
All repository users who can open an issue may trigger the read-only model job.

The writer is a fresh job with `contents: read` and `issues: write`. It receives
no OpenAI credential. Before its first mutation it parses the schema, verifies
the current open issue, verifies every related issue exists and is not a pull
request, verifies the label allowlist, and checks the idempotency marker.

## Output and relationships

The only predeclared label is `enhancement`. The structured comment records a
feature identity, safe-parallel result, confidence, rationale, and explicit
typed relationships. Relationship types are hard prerequisite, ordering
constraint, shared mutation/release boundary, external/user gate, and
independent. Labels are never treated as dependency evidence.

The marker is `momi-issue-triage:v1` plus the issue number. A retry updates the
one matching comment and adds the same allowlisted label idempotently. Multiple
matching comments are ambiguous and fail closed.

## Re-triage and failure recovery

Use the workflow's manual `workflow_dispatch` input with one open issue number.
No issue edit, comment, or label event triggers the workflow, preventing loops.
Concurrency serializes runs per issue, and each run has explicit timeouts.

Invalid JSON, extra fields, duplicate or excessive references, self references,
missing issues, pull request references, unavailable labels, unsafe text, and
ambiguous markers fail before issue mutation. Model/action failures also skip
the writer. Inspect the failed run, correct the issue text or workflow defect,
then dispatch one manual re-triage. Never hand-edit the marker or add a second
triage comment.

Cost is bounded by one low-effort model call per open or manual dispatch, the
capped context above, an eight-reference maximum, and short schema fields.
