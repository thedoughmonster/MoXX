# MoMi Order API V1

## Purpose

The MoMi Order API is the only application-facing boundary for order reads.
It resolves orders from an approved, versioned warehouse view and never calls
Toast or reads a raw source table directly.

## HTTP Contract

The route is `POST /functions/v1/momi-orders-get-by-guid-v1`. Its function key is
`momi.orders.get_by_guid.v1`.

The strict JSON input is:

```json
{"work_id":"123","order_guid":"toast-guid","trigger_token":"uuid"}
```

The publishable project key permits gateway entry. Authorization comes from the
matching private durable work row, exact order GUID, active read-view registry
entry, running status, and per-work capability token. The selected view row must
match the immutable order version attached to that work. Callers pass identity
only, never an order document received from Toast.

## Warehouse Contract

The API reads one explicitly named versioned order view. That view owns:

- Selection of the current successful full-order resource version.
- Documented ordering and tie-breaking rules.
- Approved order projections and joins.
- Retrieval time and source update time when available.
- Freshness or stale status.

The view may join related projections and does not need to flatten the complete
order into one table. Every projection must be rebuildable from permanent raw
resource versions without calling Toast.

The view uses `security_invoker = true` and remains inaccessible to public,
anonymous, and authenticated database roles unless a later access contract adds
specific grants and row-level policies.

## Behavior

A read returns the latest approved warehouse representation available for the
GUID. It does not trigger hydration, wait for Toast, or silently fall back to a
source API.

The successful response contains the complete order JSON returned by the
approved view plus order version id, restaurant GUID, retrieval time, content
hash, contract key, and contract version. The API records no eligibility or
delivery decision.

After hydration commits, durable invocation work may ask a dedicated invoker to
call this API with the GUID. Its idempotency key includes the GUID, resource
version identity, and API contract version.

## Failure Behavior

Unknown orders return a not-found result. Missing or stale data remains explicit
in the response contract. Source API availability does not alter API behavior.

## Non-Goals

- No direct Toast calls.
- No raw-table reads.
- No request-time hydration.
- No order mutation, eligibility decision, or Slack delivery.
- No dependency on continued Toast availability.
