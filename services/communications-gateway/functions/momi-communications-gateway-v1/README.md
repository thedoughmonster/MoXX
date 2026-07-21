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

Zac's admin route can adjust each user's per-minute, per-day, input, output,
timeout, and total beta-budget ceilings independently.

An exact affirmative final user command `log this message`, `log this turn`, or
`log this conversation` excludes the command itself. Message selects the
immediately preceding model-visible message, turn selects the preceding
user-led turn, and conversation selects all preceding messages; bare `log this`
means turn. Negated, quoted, embedded, or non-final text never creates a flag.

## Output

The response is OpenAI-compatible and keeps the visible alias provider-neutral.
The provider call uses the authenticated user's opaque UUID as a stable
privacy-preserving safety identifier.

## Side Effects

Before provider egress the function admits the invocation, enforces access and
limits, and archives the exact request and tool definitions. It archives every
provider response and tool result before advancing, then commits terminal state.
The strict zero-argument `create_momi_log` tool can only replay an already
resolved authenticated user flag through the operations-owner contract. Its
identity is the same as the deterministic pre-provider append, so it collapses.

## Failure Handling

Same-key/same-payload replay returns existing execution state. Changed payloads
fail. Any provider transport ambiguity becomes `paid_ambiguous` and is never
automatically retried. Missing configuration fails closed.

## Tests

Run `pnpm check -- --service communications-gateway`.
