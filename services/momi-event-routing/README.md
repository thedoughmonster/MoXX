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
declared provider contract. These commands now execute as bounded
`SECURITY DEFINER` capabilities, with direct execution granted only to declared
service roles that exist in migration history. Schema `USAGE` remains withheld
until the pre-existing shared `momi_events` schema authority declaration is
reconciled; no broad schema grant is introduced by this slice.

`momi.events.delivery_reference.v1` returns immutable, reference-only event
fields for one exact live order-alert or warehouse-projection delivery. The
matching `momi.events.delivery_witness.v1` routines lock and attest the same
rotating delivery capability without exposing routing tables. The order-alert
wake authorization is fixed to its active subscription and exact queued tuple.

`momi.events.warehouse_delivery_reservation.v1` owns bounded projection claim
and reservation state inside `momi_events`. Reservations rotate capabilities,
expire after 5 to 120 seconds, and count with live deliveries against a caller
supplied 1 to 32 worker limit. This additive owner path preserves the disabled
Edge rollback route while database processing remains active.

`momi.events.warehouse_append.v1` appends an immutable `warehouse.*` reference
with required entity identity and schema version 1 or 2. Exact replay returns
the original event identity. Re-observing an unchanged canonical entity version
also returns its first event while preserving the original occurrence and
correlation metadata; this includes the pre-cutover type-specific `observed`
name and the staged-menu `warehouse.menu_entity.observed` name for `menu`,
`menu_group`, `menu_item`, `modifier_group`, and `modifier_option`. Any change
to its entity, source, schema, or stored reference raises a unique violation,
as does every divergent non-entity-version replay.

The database role model proves bounded DB-native capability execution. Shared
project Edge credentials do not prove per-workload isolation; that is separate
follow-up hardening and is not claimed by these contracts.

Canonical replay events with no matching active subscriber and no delivery are
completed set-wise. Source events, subscribed events, and running leases always
remain on the standard capability-bound router.

Run `pnpm check` from the repository root.
