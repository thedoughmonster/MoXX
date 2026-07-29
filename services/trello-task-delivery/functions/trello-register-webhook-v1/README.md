# Trello Register Webhook v1

## ELI5

This worker takes one already-approved instruction to connect a Trello board to
MoMi's callback and records exactly what Trello returned.

## Trigger And Input

`POST /functions/v1/trello-register-webhook-v1` accepts only an `operation_id`
and its single-operation `capability_token`.

## Output

The response reports `succeeded`, `failed`, or `ambiguous`. It never returns
credentials or the destination response body.

## Side Effects

Claims one durable prepared registration and performs exactly one Trello POST.
The operation carries opaque references to a fresh acquisition-owned webhook
inventory and a successful callback HEAD probe. This service does not
dereference either proof or read provider state.

## Failure Handling

The function records the complete Trello response body plus a small safe header
allowlist. A network, server, or unprovable success result is ambiguous and is
never retried automatically; reconciliation returns to data acquisition.

## Tests

Tests cover strict work parsing, exact single-POST behavior, prepared
precondition references, ambiguity-stop semantics, and private migration
authority.
