# Warehouse Projection

## ELI5

MoMi receives small notes that point to already-saved Toast data. This service
checks each note against the saved event and asks the database to update the
warehouse. It never calls Toast or carries a source payload in the queue.

## Purpose

This capability consumes durable Toast source-event deliveries and projects
their referenced records into canonical warehouse entities and observations.
Stock polling is projected from one response-level event per acquisition job;
all item observations retain individual provenance under one canonical snapshot
ID, and consumers receive one `warehouse.stock_snapshot.observed` event.

## Owned Function

`momi-warehouse-projection-worker-v1` claims one exact capability-bound
delivery, runs the Toast event projector, and records its durable outcome.

## Contracts

The service provides `momi.warehouse_projection.toast.consume.v1`. Its wake
contains only the event ID, queue message ID, and delivery-owned capability;
source records remain in private database schemas. Queuing a delivery only
commits durable work; recovery wakes one due delivery every three seconds.

## Authority

The service may read private event deliveries and invoke owned database
projection procedures. It has no network authority and no Toast credentials.

## Verification

Run `npm run check -- --service warehouse-projection` with Node.js 24.
