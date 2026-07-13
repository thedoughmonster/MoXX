# MoMi Order Read by GUID v1

## Purpose

This function is MoMi's owned read boundary for one fully hydrated Toast order.
It serves warehouse data and never falls back to the vendor API.

- Function key: `momi.orders.get_by_guid.v1`
- Route: `/functions/v1/momi-orders-get-by-guid-v1`
- Boundary: MoMi internal

## HTTP Contract

`POST` accepts `work_id`, `order_guid`, and the matching `trigger_token`; see
`contracts/input.schema.json`. Authorization requires the exact running durable
work row and active registered read contract. Gateway JWT verification is
disabled because that per-work capability is the authorization boundary.

The successful response returns warehouse metadata and the complete source
order payload defined in `contracts/output.schema.json`.

## Read Flow

1. Match the request to its durable Order API work.
2. Require the versioned read-view registration to be active.
3. Read the work's immutable order version from
   `momi_api.toast_orders_by_guid_v1`.
4. Return the complete payload without business transformation.

## Authority Boundary

This function may read only the approved versioned view. It never reads a raw
table, calls Toast or Slack, mutates work, or makes an alert decision.

## Configuration

- `SUPABASE_DB_URL`: private database connection supplied by Supabase.
- Read contract activation and view mapping live in database configuration.

See the [function manifest](function.json), [local rules](AGENTS.md), and
[Order API contract](../../../docs/contracts/momi-order-api-v1.md). Run
`npm test` from the repository root with Node.js 24.
