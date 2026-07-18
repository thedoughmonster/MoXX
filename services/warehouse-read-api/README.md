# Warehouse Read API

## ELI5

This service returns one clean Dough Monster record regardless of which point
of sale supplied it. Complete published menus stay complete even when a later,
sparse configuration observation refers to the same entity.

## Contracts

This core capability serves canonical orders, payments, menu entities,
employees, schedules, and latest stock observations through versioned `momi.*`
HTTP contracts. The five entity routes share one reader while retaining their
own manifests and registrations.

The service consumes `momi.warehouse.canonical_read_views.v1` from
`warehouse-projection`. That contract maps the exact versioned database views;
it does not grant access to canonical base tables.

Callers provide only Dough Monster UUIDs and an expiring, one-use durable read
token. Every response contains a normalized document, schema version,
source-neutral provenance, and freshness. `canonical-resource-v2` responses use
DM-owned identity and vocabulary; source DTOs and source identifiers never
become request requirements or canonical document fields.

`momi.orders.get_by_version.v1` additionally binds the token and request to one
immutable canonical order-version UUID. Event consumers can therefore decide
the exact observation that triggered them even if a newer version arrives.

## Version Selection

`momi_api.warehouse_entities_by_id_v1` normally selects the newest observation,
then projection time and version ID. For `menu`, `menu_group`, `menu_item`,
`modifier_group`, and `modifier_option`, a version whose provenance
`resource_type` is `menu` is ranked first, before recency. A complete published
menu document therefore takes precedence over sparse `menu_configuration` or
reference snapshots, even when a sparse snapshot was observed later.

Published menu documents expose rich names, images, sales channels, tags,
prices, SKU/PLU, calories, selection rules, ordering state, and relationships.
Provenance and freshness still identify when and from where that chosen version
was observed without leaking a source DTO.

## Boundary

The API reads approved versioned views only and never fetches Toast or reads
`toast_raw` directly. Exact raw reconstruction remains privileged archive work.
Toast acquisition and webhook HTTP boundaries are unchanged. The legacy source
reader remains separate until order-alert migration is complete. Its dynamic
view identifier is exact current access debt. While it remains, every runtime
TypeScript file in this service is source-hashed into that finding, so any code
change must first replace the dynamic identifier with static relation reads.

## Verification

Run `npm run check -- --service warehouse-read-api` with Node.js 24.
