# MoMi Communications Gateway v1

## ELI5

This is OpenWebUI's guarded provider-neutral model endpoint. Auto uses one small
router; explicit Quick, Standard, Deep, or Maximum profiles bypass it. The
gateway checks the exact user and adjustable route ceiling, calls the selected
model at most once per round, uses only approved tools, and saves complete
archive evidence.

## Trigger And Input

The thin OpenWebUI Pipe calls `GET /models` or `POST /chat/completions` with the
purpose-bound gateway credential outside model-visible input. Chat input carries
the authenticated OpenWebUI user ID/email, conversation/turn IDs, idempotency
key, alias, and OpenAI-compatible ordered messages.

Zac's admin route can adjust each user's per-minute, per-day, input, output,
timeout, total beta-budget, default route, and maximum route independently.

An exact affirmative final user command `log this message`, `log this turn`, or
`log this conversation` excludes the command itself. Message selects the
immediately preceding model-visible message, turn selects the preceding
user-led turn, and conversation selects all preceding messages; bare `log this`
means turn. Negated, quoted, embedded, or non-final text never creates a flag.

## Output

The response is OpenAI-compatible and keeps every visible name provider-neutral.
The provider call uses the authenticated user's opaque UUID as a stable
privacy-preserving safety identifier. Routing profiles set the provider model,
reasoning effort, and output ceiling; the tool contracts remain unchanged.
The gateway uses stateless Responses for the structured router and selected
answer. Each route's database mapping bounds its answer calls; within that
limit the gateway continues approved tool calls until the model returns text.

Natural shop questions use the database-mapped analysis catalog and one
read-only SQL tool. The model never needs to expose SQL, relation names, or
internal UUIDs to the user. It resolves product aliases through mapped name
fields, discovers business enum values before filtering, reconciles new query
evidence with earlier sourced claims, and applies the documented order-time
coverage fallback. The explicit logger remains a separate write tool.

Maximum creates each answer round as one background provider response and polls
that response ID until it becomes terminal or the admitted user deadline ends.
Poll retrieval is continuation of the same paid attempt, not a model retry.
If a non-ambiguous background or mapped-round limit ends the analysis first,
the gateway completes with a durable, non-empty provider-neutral explanation
that OpenWebUI can render and replay without another provider attempt.

## Side Effects

Before provider egress the function admits the invocation, enforces access and
limits, and archives the exact request and tool definitions. It archives every
provider response and tool result before advancing, then commits terminal state.
The strict zero-argument `create_momi_log` tool can only replay an already
resolved authenticated user flag through the operations-owner contract. Its
identity is the same as the deterministic pre-provider append, so it collapses.

## Failure Handling

Same-key/same-payload replay returns the exact durable assistant response only
for completed execution. In-flight, failed, ambiguous, missing, corrupt, or
identity-mismatched replay evidence returns a non-2xx failure without another
provider call. Changed payloads fail. Any provider transport ambiguity becomes
`paid_ambiguous` and is never
automatically retried. Adjustable request or budget limits return
`request_limit_reached` with HTTP 429, and oversized effective input returns
`input_limit_reached` with HTTP 413, so the client can render a useful message.
An unfinished Maximum response and every provider failure include a safe,
non-empty visible explanation. Analysis failures identify only an actionable
safe category and never expose SQL or database internals. Missing or unexpected
configuration still fails closed.

## Tests

Run `pnpm check -- --service communications-gateway`.
