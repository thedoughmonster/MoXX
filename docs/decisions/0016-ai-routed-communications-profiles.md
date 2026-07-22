# 0016: AI-routed communications profiles

- Status: accepted
- Date: 2026-07-22

## Context

Routine staff questions should not consume the same model capacity as difficult
analysis. Zac also needs explicit control over reasoning depth without exposing
provider identities as product models.

## Decision

Keep `communications-gateway` as the sole routing owner. Its `momi-assistant`
path uses one small, structured-output routing call to select Quick, Standard,
or Deep. Provider-neutral explicit selections bypass that call. Maximum is
explicit-only. A user's adjustable default and maximum route are enforced by
the gateway before the selected provider call.

The router receives only a bounded recent conversation excerpt and returns a
route, confidence, and short reason. It cannot call tools or answer the user.
Database policy constrains every result; invalid output falls back to the
user's configured default. Ambiguous paid transport never retries or falls
back. Every routing request, response, selected profile, and provider exchange
is archived under the existing invocation identity.

The OpenWebUI Pipe remains a credential-blind transport. It may list Auto,
Quick, Standard, Deep, and Maximum, but it maps all of them to the same gateway
contract with a provider-neutral route request. Provider model names, keys,
budgets, tools, and authorization remain backend-owned.

Both the routing and selected answer calls use the stateless Responses API so
structured output, reasoning profiles, and strict function tools remain
compatible. When a tool is called, the gateway
replays every returned output item, including opaque reasoning state, with the
matching function result; OpenWebUI still receives its existing compatible chat
response shape.

## Consequences

Model and reasoning depth can change without changing the product identity.
Explicit selection saves the router call. Automatic selection adds one paid
call and is bounded to three total provider attempts including one tool round.
Parallel or recursively delegated agents are not authorized by this decision.
