# `momi-warehouse-schedules-get-by-id-v1`

## ELI5

Give this reader a Dough Monster schedule ID and an approved read token, and it
returns the newest clean schedule record.

## Trigger And Input

`POST` accepts a durable read work ID, canonical entity UUID, and that work's
capability token. `GET` is health only.

## Output

The response contains the canonical schedule document, stable entity identity,
schema version, provenance, and freshness. No source DTO or source ID is needed.

Online-ordering documents contain a source-neutral time zone, scheduled-order
policy, weekly periods, and date exceptions. Periods use numeric weekdays,
`pickup` or `delivery` fulfillment modes, local `HH:MM:SS` times, and an
explicit overnight flag. Date exceptions identify closures with an empty
period list. Exact source fields remain available only in the private archive.

## Side Effects

The supplied read capability is consumed exactly once.

## Failure Handling

Invalid or unauthorized requests are rejected. Inactive contracts, missing
schedules, and internal read failures have distinct responses.

## Tests

Service tests cover strict canonical input, source-neutral output, durable token
authorization, and route registration. Run `npm run test -- --service
warehouse-read-api` from the repository root.
