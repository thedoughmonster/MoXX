# Model execution completion worker v1

## ELI5

When a long model answer finishes after the original app request has ended,
this worker safely picks it back up and tells the service that owns the turn.

## Trigger And Input

`POST /functions/v1/momi-model-execution-completion-worker-v1` accepts one
database-issued work UUID and its single-use capability token.

## Output

It returns only a content-free disposition: completed, retrying, or duplicate.

## Side Effects

Claims one capability-bound completion work item, retrieves the terminal OpenAI
Response without persisting its body, updates content-free execution metadata,
and notifies the owning caller using an identifier-only callback. Lease expiry
and the 30-second reconciliation schedule recover missed webhooks and worker
failures.

## Failure Handling

Pending responses and temporary callback failures are retried with bounded
backoff. Expired leases are reclaimed; exhausted work becomes dead-lettered.

## Tests

Tests cover request parsing, capability-bound SQL, metadata-only retrieval,
identifier-only callback payloads, and bounded retry behavior.
