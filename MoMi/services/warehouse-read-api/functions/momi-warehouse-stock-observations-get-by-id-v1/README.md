# `momi-warehouse-stock-observations-get-by-id-v1`

## ELI5

Give this reader Dough Monster item and location IDs plus an approved read token,
and it returns the newest stock observation for that pair.

## Trigger And Input

`POST` accepts a durable read work ID, canonical item and location UUIDs, and
that work's capability token. `GET` is health only.

## Output

The response contains a normalized latest-observation document, stable item and
location IDs, schema version, provenance, and freshness. Quantity is an exact
decimal string or null. No source DTO or source ID is needed.

## Side Effects

The supplied read capability is consumed exactly once.

## Failure Handling

Invalid or unauthorized requests are rejected. Inactive contracts, missing
observations, and internal read failures have distinct responses.

## Tests

Service tests cover strict canonical input, source-neutral output, durable token
authorization, and route registration. Run `npm run test -- --service
warehouse-read-api` from the repository root.
