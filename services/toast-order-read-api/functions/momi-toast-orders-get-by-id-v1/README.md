# MoMi Toast Order Read by ID v1

## ELI5

This function gets one saved Toast order for another MoMi function. It first
checks that the caller has the exact work permission, then opens the
approved database view and returns the complete saved JSON. It never calls
Toast and never changes the order. The view also supplies readable receipt
lines from names already present in that saved response.

## Purpose

This is the Toast-specific owned read boundary for one exact saved order
version, whether it came from a webhook or an approved hydration operation.

- Function key: `momi.toast_orders.get_by_id.v1`
- Route: `/functions/v1/momi-toast-orders-get-by-id-v1`
- Owner: `toast-order-read-api`
- Boundary: MoMi internal

## Trigger And Input

`POST` accepts `work_id`, `order_id`, and the matching `trigger_token`; see
`contracts/input.schema.json`. Authorization requires the exact running durable
work row, Toast source, contract key, order id, and active registered read
contract. The per-work capability is the authorization boundary.

## Output

The successful response returns warehouse metadata, the complete source order
payload, and a separate source-neutral `order_presentation` defined in
`contracts/output.schema.json`.

## Read Flow

1. Match the request to its running Toast Order API work and token.
2. Require the versioned read-view registration to be active.
3. Match order id, location, and immutable source version in
   `momi_api.toast_orders_by_id_v1`.
4. Return the unchanged payload and the view-derived presentation together.

## Side Effects

None. The function performs an authorized read and does not mutate durable work
or source records.

## Failure Handling

Malformed or unauthorized capabilities are rejected without revealing whether
an order exists. Missing approved data returns not found; internal failures are
logged without tokens or order payloads.

## Authority Boundary

This function may read only the approved versioned view. It never reads a raw
table, calls Toast or Slack, mutates work, or makes an alert decision.

## Configuration

- `SUPABASE_DB_URL`: private database connection supplied by Supabase.
- Read contract activation and view mapping live in database configuration.

## Tests

See the [function manifest](function.json), [service rules](../../AGENTS.md),
and [Toast Order API contract](../../../../docs/contracts/momi-toast-order-api-v1.md).
Run `npm run check -- --service toast-order-read-api` from the repository root.
