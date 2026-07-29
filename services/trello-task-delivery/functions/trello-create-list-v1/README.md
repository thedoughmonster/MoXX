# Trello Create List v1

## ELI5

This worker takes one already-approved instruction to add a list to Trello and
records exactly what Trello returned.

## Trigger And Input

`POST /functions/v1/trello-create-list-v1` accepts only an `operation_id` and
its single-operation `capability_token`.

## Output

The response reports `succeeded`, `failed`, or `ambiguous`. It never returns
credentials or the destination response body.

## Side Effects

The worker claims one durable `create_list` operation, sends one Trello REST
mutation with a non-secret operation marker, and records the complete response.

## Failure Handling

Network errors and server errors become `ambiguous` and are never blindly
retried. Client errors become `failed`. Logs contain only the durable operation
identity and error name.

## Tests

Tests cover strict work parsing, header-only authentication, operation markers,
complete response capture, and the migration's replay and permission rules.
