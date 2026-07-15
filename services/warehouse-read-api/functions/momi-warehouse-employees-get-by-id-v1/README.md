# `momi-warehouse-employees-get-by-id-v1`

## ELI5

Give this reader a Dough Monster employee ID and an approved read token, and it
returns the newest clean employee record.

## Trigger And Input

`POST` accepts a durable read work ID, canonical entity UUID, and that work's
capability token. `GET` is health only.

## Output

The response contains the canonical employee document, stable entity identity,
schema version, provenance, and freshness. No source DTO or source ID is needed.

## Side Effects

The supplied read capability is consumed exactly once.

## Failure Handling

Invalid or unauthorized requests are rejected. Inactive contracts, missing
employees, and internal read failures have distinct responses.

## Tests

Service tests cover strict canonical input, source-neutral output, durable token
authorization, and route registration. Run `npm run test -- --service
warehouse-read-api` from the repository root.
