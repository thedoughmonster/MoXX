# Warehouse Projection Rules

- Claim only the exact durable delivery named by event ID and message ID.
- Require its rotating per-delivery capability token for every lifecycle call.
- Use the core 120-second delivery lease; never pull a worker-side batch.
- Begin, acknowledge, retry, and dead-letter through `momi_events` functions.
- Re-read the source event before invoking its database projector.
- Treat only explicit `ignored_*` projector results as successful no-ops.
- Do not fetch source data or read Toast credentials in this service.
- Let core reconciliation reclaim expired leases and rotate their capabilities.
