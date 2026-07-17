# `momi-communications-evaluate-item-v1`

## ELI5

This worker wakes only when an archived note needs review. It safely reserves
that note, asks the configured model for a structured judgment, and saves the
judgment separately from the original.

## Trigger And Input

`POST` accepts exactly `evaluation_job_id` and `capability_token`. The token
authorizes one durable claim. `GET` returns `200` only when all required runtime
settings are present; otherwise it returns a redacted `503`. A dormant database
schedule selects due work every 30 seconds and sends only this exact envelope.

```json
{
  "evaluation_job_id": "42",
  "capability_token": "22222222-2222-4222-8222-222222222222"
}
```

The runtime requires `SUPABASE_DB_URL`, `OPENAI_API_KEY`, and
`MOMI_COMMUNICATIONS_EVALUATOR_MODEL`. The route and schedule stay inactive
until those secrets and the hosted function have been verified.

For rollout, `dispatch_evaluation_job_v1` wakes one exact due job without
returning its token. The job and queue status RPCs return redacted processing
metadata only. These operator contracts are granted solely to `service_role`.

## Output

A stale, completed, or duplicate token returns `duplicate` without a model
request. Successful work returns `evaluated`, the immutable evaluation ID, and
the derived-record count. Recoverable failures return `retrying`.

## Side Effects

The function claims a five-minute lease through an owned database function,
calls only `https://api.openai.com/v1/responses`, and atomically appends strict
evaluation output, optional linked derived records, and audit evidence. It
emits routing hints but never calls ClickUp, GitHub, or another destination.

## Failure Handling

Invalid envelopes return `400`. Duplicate work returns `202`. Model or
persistence errors return `503` after bounded retry state is recorded. The
fifth failed attempt becomes a dead letter. Logs contain identifiers and error
messages only, never source content, model output, credentials, or work tokens.

## Tests

Run `pnpm run test -- --service communications-evaluation`. Tests prove exact
request parsing, zero model calls without a claim, strict model output,
idempotent lifecycle RPCs, redacted health/status, and no-work scheduling.
