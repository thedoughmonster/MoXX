# `momi-orders-get-by-version-v1`

## ELI5

Give this reader a Dough Monster order ID, an exact saved version ID, and a
short-lived read capability. It returns that version, even when a newer one
exists.

`POST` accepts a durable work ID, canonical order UUID, canonical order-version
UUID, and capability token. The reader atomically consumes the version-scoped
capability, validates the active registry entry, and returns the exact canonical
order version.

## Trigger And Input

An internal consumer sends exactly `work_id`, `order_id`, `order_version_id`,
and `capability_token`. The three entity and token identifiers are UUIDs;
`work_id` is a positive bigint string. Unscoped and extra fields are rejected.
`GET` is health only.

## Output

The response contains the canonical order and order-version IDs, schema version,
document, presentation, provenance, and freshness. It contains no upstream DTO
and does not require an upstream identifier.

## Side Effects

The supplied version-scoped read capability is consumed exactly once.

## Failure Handling

Invalid or unauthorized work is rejected. Inactive contracts and missing exact
order versions have distinct responses; internal read failures return a generic
error.

## Tests

Tests enforce the exact four-field input, source-neutral output, version-scoped
capability consumption, registry mapping, and two-ID row match. Run
`node --test services/warehouse-read-api/functions/momi-orders-get-by-version-v1/tests/contract.test.ts`
from the repository root.
