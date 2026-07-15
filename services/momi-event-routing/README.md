# MoMi Event Routing

## ELI5

This service puts each saved event note into the correct private inbox without
copying the source document onto the note.

This core capability moves append-only `source.*` and `warehouse.*` event
references into one private PGMQ queue per subscriber. It does not interpret
source documents or call external systems.

Collection responses that contain many stock items enter routing as one
snapshot event. Item-level source observations remain queryable in the archive
without creating one network wake-up per item.

`momi-event-router-v1` accepts one durable event identity and capability token,
claims its 120-second lease, creates idempotent subscriber deliveries, and
marks routing complete. Failures return to durable exponential retry state;
consumer failures are handled by the separate delivery lifecycle functions.

Run `pnpm check` from the repository root.
