# OpenAI model completion webhook v1

## ELI5

OpenAI tells this endpoint that a long answer finished. The endpoint proves the
message is genuine, remembers only safe IDs, and wakes the background worker.

## Trigger And Input

`POST /functions/v1/momi-model-execution-webhook-v1` receives the raw Standard
Webhooks request body and signature headers from OpenAI.

## Output

It quickly returns an enqueued, duplicate, or ignored content-free disposition.

## Side Effects

Reads the raw request body once, authenticates it with the official OpenAI SDK
and `OPENAI_WEBHOOK_SECRET`, records only event/response identifiers and timing,
deduplicates `webhook-id`, and returns promptly. The terminal response body is
retrieved by the durable completion worker and is never stored in this service.

## Failure Handling

Missing configuration, malformed events, and invalid signatures fail before
persistence. Authenticated duplicates are acknowledged without repeated work.

## Tests

Tests cover raw-body verification order, supported event parsing, webhook-ID
deduplication, ignored unrelated responses, and quick background dispatch.
