# `momi-orders-get-by-id-v1`

## ELI5

Give this reader a Dough Monster order number and a short-lived read capability,
and it returns the latest clean order record.

`POST` accepts an expiring read-capability ID, stable DM order UUID, and its
capability token. The reader atomically consumes it, validates its live alert
delivery binding and active registry entry, then returns the canonical order.

## Trigger And Input

An internal consumer sends the read-capability ID, canonical order UUID, and
capability token. Alert work tokens and delivery capabilities are rejected.
`GET` is health only.

## Output

The response contains canonical order and location IDs, schema version,
presentation, provenance, and freshness. It contains no upstream DTO and does
not require an upstream identifier. `GET` is a health check.

## Side Effects

The supplied read capability is consumed exactly once.

## Failure Handling

Invalid or unauthorized work is rejected. Inactive contracts and missing orders
have distinct responses; internal read failures return a generic error.

## Tests

Tests enforce UUID input and ensure the output contract requires no source DTO.
Run `pnpm check` from the repository root.
