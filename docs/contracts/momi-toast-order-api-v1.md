# MoMi Toast Order API V1

## Purpose

This is MoMi's retiring Toast-specific read facade. It returns one exact,
complete Toast order version already captured by MoMi. The version may come
from a webhook or approved hydration. The API owns authorization and routing,
not the source or projection dataset; it never calls Toast, chooses alert
behavior, or reads a raw table directly.

The Toast name is intentional: the response payload is Toast's complete order
document. A future Square reader will have its own contract while sharing the
same outer MoMi envelope.

## HTTP Contract

The route is `POST /functions/v1/momi-toast-orders-get-by-id-v1`. Its function
key is `momi.toast_orders.get_by_id.v1`.

The strict JSON input is:

```json
{"work_id":"123","order_id":"toast-guid","trigger_token":"uuid"}
```

The publishable project key permits gateway entry. Authorization comes from the
matching private durable work row, source system, order id, exact API contract,
running status, and per-work capability token. Callers pass identity only,
never an order document received directly from Toast.

## Warehouse Contract

The function reads the warehouse-projection-owned
`momi_api.toast_orders_by_id_v1`, whose active registration must match this
contract. The row must match the immutable source version and location recorded
on `momi_orders.api_invocation_work`. The underlying approved view can expose a
complete webhook `details.order` object or a complete hydrated resource without
changing this API contract.

The view reads a complete Toast order resource version and exposes:

- `source_system`
- `source_version_id`
- `location_id`
- `order_id`
- `retrieved_at`
- `content_hash`
- Complete `payload`
- Source-neutral `order_presentation` derived from receipt names already present
  in the complete Toast response

The view uses `security_invoker = true` and remains inaccessible to public,
anonymous, and authenticated database roles.

## Response Envelope

A successful response includes the contract key and version, trace and work
identity, `work_source_version_id`, source system, source version, order and
location ids, retrieval metadata, content hash, the complete Toast payload, and
the separate presentation. The worker validates all of these before use.

## Behavior

The function returns the exact source version named by durable work. It does
not select a newer order, trigger hydration, wait for Toast, or silently fall
back to a source API. Unknown or mismatched work is forbidden; inactive
contracts and missing warehouse versions are explicit failures.

## Non-Goals

- No direct Toast calls.
- No raw-table reads.
- No request-time hydration.
- No order mutation, alert decision, or Slack delivery.
- No mutation or replacement of the complete Toast payload.
