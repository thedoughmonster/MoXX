# `momi-communications-capture-openai-message-v1`

## ELI5

Give this function one ChatGPT/OpenAI message and its source identity; it stores
the original message once and creates a review ticket.

## Trigger And Input

`POST` accepts one OpenAI/ChatGPT message payload with account, user,
conversation, message, role, source metadata, and an idempotency key. `GET` is
health only. The Supabase gateway must verify the caller JWT, and the handler
accepts only `authenticated` or `service_role` claims.

## Output

The response returns `stored` for a new archive item or `duplicate` for a replay,
plus the archive item ID and evaluation job ID.

## Side Effects

The function calls the structured database capture RPC. It writes no source
tables directly and performs no source, destination, or evaluator network calls.

## Failure Handling

Invalid payloads return `400`. Missing database configuration returns `503`.
Persistence failures return `500` without logging full source payloads.

## Tests

Contract tests cover request validation, RPC usage, idempotency, immutable
archive migrations, and evaluator job staging.
