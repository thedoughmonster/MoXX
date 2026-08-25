# MoMi Event Routing

## ELI5

This service puts each saved event note into the correct private inbox without
copying the source document onto the note.

This core capability moves append-only `source.*` and `warehouse.*` event
references into one private PGMQ queue per subscriber. It does not interpret
source documents or call external systems.

Producers append one immutable reference through `momi.events.append.v1`.
Identical idempotency replay returns the existing event; conflicting replay
fails. The append transaction creates durable routing work through the existing
insert trigger but never routes synchronously or reads producer-private state.

Collection responses that contain many stock items enter routing as one
snapshot event. Item-level source observations remain queryable in the archive
without creating one network wake-up per item.

`momi-event-router-v1` accepts one durable event identity and capability token,
claims its 120-second lease, and then drains up to 49 additional due events on
the same database session. Every event retains an independent capability,
idempotent subscriber deliveries, and exponential retry state. Consumer
failures are handled by the separate delivery lifecycle functions.

`momi.events.delivery_lifecycle.v1` maps the exact private routing commands
`momi_events.begin_delivery`, `ack_delivery`, and `fail_delivery`. Repository
checks permit consumer source to call only those mapped routine names under the
declared provider contract. Hosted role/grant isolation is still deferred;
routing tables are private by declaration, not yet by runtime attestation.

Canonical replay events with no matching active subscriber and no delivery are
completed set-wise. Source events, subscribed events, and running leases always
remain on the standard capability-bound router.

Run `pnpm check` from the repository root.
