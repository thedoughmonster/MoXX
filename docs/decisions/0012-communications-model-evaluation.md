# 0012: Communications Model Evaluation

- Status: accepted
- Date: 2026-07-17

## Context

The communications archive already creates one durable evaluation job for every
new source item or operational note. It does not yet claim those jobs, evaluate
their contents, persist classifier output, or recover failed work.

Running a model for an empty queue would add cost without improving integrity.
Calling a model directly from capture would also couple immutable ingestion to
an external dependency and make archive availability depend on evaluation.

## Decision

Extend `communications-archive` with the versioned
`momi.communications.evaluate_item.v1` decision function. Capture remains a
storage-only path. The evaluator starts only from a durable job identity and
capability token, claims a short database lease through a structured RPC, reads
the immutable candidate through that RPC, and calls `api.openai.com` using a
runtime secret and configured model.

A scheduled database dispatcher selects due work with `FOR UPDATE SKIP LOCKED`,
rotates its capability token, and lets an exact trigger adapter wake the Edge
Function. An empty selection updates no rows, invokes no Edge Function, and
makes no model request. Failed and expired leases use bounded exponential retry
and eventually enter a dead-letter state.

Completion is one atomic database operation. It appends one immutable
evaluation, zero or more separately linked derived records, and audit evidence
before marking the mutable job complete. Model output is strict structured JSON
and includes validation, archive disposition, urgency, impact, confidence,
flags, and optional generic derived records.

Derived tasks may carry a neutral `destination_hint` such as `github_issue` or
`clickup`, but this service does not call either destination. Destination
adapters and their routing policy require later decisions.

The function registry entry, trigger route, and schedule are created inactive.
They may be activated only after the matching hosted function and required
secrets have been deployed and probed in that environment.

Health fails closed when runtime settings are absent. Service-role operators
may dispatch one exact due job and read redacted job or queue state for canary
verification; these contracts never return source content or work tokens.

## Consequences

- Archive capture remains available when OpenAI is unavailable.
- No model cost is incurred while no evaluation work is due.
- Capability tokens, leases, retries, and idempotent completion constrain
  duplicate or stale invocations.
- A real one-job canary can prove model configuration before scheduling starts.
- Original communications remain immutable; evaluations and derived records
  remain separate, append-only evidence.
- The service gains narrowly declared outbound access to `api.openai.com` and
  the `OPENAI_API_KEY` and evaluator-model secrets.
- ClickUp and GitHub issue creation remain out of scope.
