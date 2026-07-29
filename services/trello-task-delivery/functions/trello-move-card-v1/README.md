# Trello Move Card v1

## ELI5

This worker takes one already-approved instruction to place an existing card in
an existing Trello list and records exactly what Trello returned.

## Trigger And Input

`POST /functions/v1/trello-move-card-v1` accepts only an `operation_id` and its
single-operation `capability_token`.

## Output

The response reports `succeeded`, `failed`, or `ambiguous`. It never returns
credentials or the destination response body.

## Side Effects

The worker claims one durable `move_card` operation, sends one desired-state
Trello REST update with a non-secret operation marker, and records the complete
response.

## Failure Handling

Network, server, and unprovable responses become `ambiguous`. Client errors
become `failed`. Repeating the desired-state update is safe through a new
durable operation. Logs contain only the operation identity and error name.

## Tests

Tests cover strict work parsing, header-only authentication, exact desired
state, response validation, complete capture, and private migration authority.
