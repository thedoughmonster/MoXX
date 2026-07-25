# Model execution gateway v1

## ELI5

Approved MoMi services ask this function to run one model request. It checks who
is asking, chooses the configured model and limits, calls OpenAI once, records
safe metadata, and returns the result. It never stores the prompt or answer.

## Trigger And Input

`POST /functions/v1/momi-model-execution-gateway-v1` accepts either `create` or
`retrieve`. A bearer secret identifies exactly one caller. Create requests carry
a purpose/profile, parent invocation, idempotency key, deadline, output ceiling,
background flag, and provider-neutral payload. Retrieval names an admitted call
and its provider response identity.

## Output

The response wraps provider status, body, duration, call identity, selected
model, and ambiguity state. The wrapper lets callers preserve their existing
domain evidence without exposing the OpenAI credential.

## Side Effects

The function appends one call and one physical HTTP-exchange record and calls
only the configured OpenAI Responses endpoint.

## Failure Handling

Invalid identity, mapping, payload, limit, idempotency, or deadline fails before
provider egress. Transport ambiguity is terminal and is never retried
automatically.

## Tests

Tests cover authentication, caller-controlled field rejection, mapping,
idempotency, metadata extraction, and ambiguous outcomes.
