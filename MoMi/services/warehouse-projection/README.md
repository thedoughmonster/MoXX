# Warehouse Projection

## ELI5

MoMi saves source observations before this service turns them into stable Dough
Monster records. PostgreSQL processes due projection work every three seconds; it does
not call Toast or use an Edge HTTP wakeup.

## Purpose

This capability consumes durable Toast source-event deliveries and projects
their referenced immutable records into canonical entities and observations.
Stock polling remains one response-level event per acquisition job, with item
observations grouped under one canonical snapshot ID. Order presentation is
derived only from the event's referenced payload, not by rescanning the archive.

## Database Runtime

`momi-warehouse-projection-database-v1` calls
`warehouse_projection.process_delivery_batch(6, 60)` every three seconds. Each
iteration row-locks one due queued delivery with `SKIP LOCKED`, claims its exact
event ID, queue message ID, and rotating capability token, and immediately
commits the 120-second lease. A run stops after six deliveries or 60 seconds.

An `edge`/`database` processor fence prevents new Edge reservations during the
cutover. The delivery trigger, Edge route, and HTTP recovery job are inactive;
the deployed Edge function remains available for rollback after the setting is
returned to `edge`. Toast webhook
ingestion and Toast API acquisition keep their existing HTTP contracts.

## Delivery Lifecycle

1. `begin_delivery` must match the exact event, message, and token. It increments
   the attempt count and starts the existing 120-second lease.
2. After the claim commits, `project_and_ack_delivery` locks the running
   delivery and atomically validates its Toast source reference,
   accepts only projected, acquisition, menu-gate, or explicit `ignored_*`
   outcomes, and atomically projects, deletes the queue message, and marks it
   delivered.
3. Projection/acknowledgement or failure is committed independently. An
   interruption therefore leaves at most one leased delivery for reconciliation.
4. Failure deletes the current queue message, then enters exponential
   `retry_wait` from 15 seconds up to one hour or dead-letters attempt 12.
5. The existing retry reconciler requeues due work with a new capability token.
   Expired leases and stale tokens cannot acknowledge or fail current work.

## Canonical Resource v2

Entity types are normalized before documents are built: `restaurant` and
`location` become `location`; `menu_configuration` becomes `menu`; stock and
catalog items become `menu_item`; pre-modifier groups/options become their
canonical modifier types; and ordering schedules and shifts become `schedule`.
Menu `_reference` and `_multilocation` variants lose those source suffixes.

`canonical-resource-v2` strips nulls and applies these source-to-canonical maps:

| Area | Mapping |
| --- | --- |
| Identity | DM-owned `id`, `entity_type`, and `location_id`; no source IDs |
| Name/state | `name <- name/displayName/title`, `status <- status/paymentStatus`, `active <- active/not deleted`, `archived <- archived/deleted` |
| Payment | `amount`, `tip_amount <- tipAmount`, paid/refund dates, `voided`, `payment_type <- type`, and `card_type <- cardType` |
| Person/labor | Names, email, phone, start/end dates, business date, hours, wages, auto-clock-out, job code, tips, and reporting exclusion |
| Dining | `behavior` and `curbside` |
| Menu | Rich menu names, images, channels, tags, price, SKU/PLU, calories, selection rules, sort order, deleted state, and `online_orderable <- orderableOnline` |

Version provenance keeps the source content hash, immutable raw reference,
observed time, and `projection_contract: canonical-resource-v2` outside the
canonical document. These entity versions and emitted events use schema version
2. Re-observation of unchanged content retains the first event occurrence and
correlation metadata. Published menu projection remains the complete source for
menu documents.

## Replay

`canonical_resource_replay_v2` derives eligible documents from immutable
`toast_raw.resource_versions` and `resource_observations` plus active source
links. Set-based insert-selects append v2 entity versions, attach every raw
observation to its exact version, and emit one idempotent `*.reconciled` event
per v2 version. Reruns merge only the same version/content identity; they do not
overwrite canonical documents, delete v1 history, or refetch Toast.

## Authority

The service owns the canonical warehouse and the versioned `momi_api` views.
`momi.warehouse.canonical_read_views.v1` exposes only the canonical views to
`warehouse-read-api`; `momi.warehouse.toast_order_read_view.v1` exposes only
`momi_api.toast_orders_by_id_v1` to the retiring Toast facade. It has no network
authority or Toast credentials.

Its current direct read of the event router's private event relation remains
fingerprinted transition debt. Removing that read requires an owner-provided
event contract; the manifest does not convert the private table into one.

Stock-snapshot projection uses exact Communications Archive and Toast Data
Acquisition reads, then appends its single batch event through
`momi.events.warehouse_append.v1`. It does not read those owners' private
relations or write the Event Routing table directly.

## Legacy Recipe Staging

`legacy-recipe-transform` owns the private `legacy_recipe_staging` preservation
schema under ADR `0014`. Warehouse projection has no authority for that schema,
does not consume it at runtime, and does not publish canonical recipes from it.

## Verification

Run `npm run check -- --service warehouse-projection` with Node.js 24.
