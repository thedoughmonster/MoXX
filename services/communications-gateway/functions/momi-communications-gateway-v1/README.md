# MoMi Communications Gateway v1

## ELI5

This is OpenWebUI's one guarded model endpoint. It lists `momi-assistant`, checks
the exact user and limits, calls the configured model at most once per round,
uses only approved tools, and saves complete archive evidence.

## Trigger And Input

The thin OpenWebUI Pipe calls `GET /models` or `POST /chat/completions` with the
purpose-bound gateway credential outside model-visible input. Chat input carries
the authenticated OpenWebUI user ID/email, conversation/turn IDs, idempotency
key, alias, and OpenAI-compatible ordered messages.

## Output

The response is OpenAI-compatible and keeps the visible alias provider-neutral.

## Side Effects

Before provider egress the function admits the invocation, enforces access and
limits, and archives the exact request and tool definitions. It archives every
provider response and tool result before advancing, then commits terminal state.

## Failure Handling

Same-key/same-payload replay returns existing execution state. Changed payloads
fail. Any provider transport ambiguity becomes `paid_ambiguous` and is never
automatically retried. Missing configuration fails closed.

## Tests

Run `pnpm check -- --service communications-gateway`.
