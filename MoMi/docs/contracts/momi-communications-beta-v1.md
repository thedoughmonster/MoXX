# MoMi Communications Beta v1

This contract defines the disabled-by-default production beta accepted in ADR
`0015`. JSON request and response schemas beside each Edge Function are the
wire-level authority; this document defines cross-owner semantics.

## Gateway

`momi.communications.chat_completions.v1` accepts an authenticated user,
conversation and turn identity, `momi-assistant`, an ordered model-visible
message array, and an idempotency key. The gateway resolves the active provider
and model from private configuration. Same-key/same-payload replay returns the
existing execution; a different payload is rejected. Pending or ambiguous paid
attempts return only redacted state and are never retried. Admission reserves
the worst-case two-round cost. Each complete provider payload, including tool
definitions and results, is checked before egress, and both paid rounds share
one whole-invocation deadline.

`list_models`, `get_conversation_execution`, `set_user_limits`,
`set_user_access`, and `set_gateway_state` are versioned gateway contracts. The
three setters require Zac's authenticated administrative identity and exact
targets through a separate purpose-bound administrative credential; the
OpenWebUI gateway credential cannot call them. All state starts disabled and
every configuration change is audited.

## Archive

`capture_gateway_exchange` appends ordered model-boundary evidence and terminal
metadata. `capture_human_message` appends one committed OpenWebUI message using
stable source account, user, conversation, and message identity. Replays
collapse only when identity and content match. Purpose-bound receipt reads
return identifiers, hashes, order, status, usage, and timing, but no protected
value or unrelated conversation content. Post-admission failures append redacted
terminal evidence before terminalization; replay exposes no archived content.

## Operations

`create_user_flagged_shop_log` accepts only authenticated `user_flag` intent,
one of `message`, `turn`, `range`, or `conversation`, stable gateway/archive
receipts, optional note/category, and an idempotency key. It appends one
selection and log. Replays return the same log; correction and supersession are
later append-only records. Model and system selections cannot use `user_flag`.
Natural-language selection accepts only a standalone affirmative imperative,
rejects negation and quotation, validates scope-specific references/content,
and invokes the append contract exactly once.

## Canonical Read Tools

The gateway requests an exact one-use capability from `warehouse-read-api` and
passes it to one approved canonical versioned reader. Responses contain source-
neutral documents plus contract version, provenance, and freshness. No tool
accepts source identifiers or exposes source DTOs, raw tables, arbitrary SQL,
generic HTTP, or request-time hydration.

## Event Append Boundary

`momi.events.append.v1` is the event-router-owned command for one immutable,
reference-only producer event. It validates bounded identity, schema version 1,
flat JSON reference metadata, and idempotency before inserting. An identical
replay returns the existing event; conflicting content fails. The append creates
durable routing work through the existing insert trigger and never routes
synchronously, copies source payloads, or reads producer-private state.
