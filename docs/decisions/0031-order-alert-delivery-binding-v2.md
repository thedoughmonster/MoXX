# 0031: Warehouse-Owned Order Alert Delivery Binding v2

- Status: accepted
- Date: 2026-08-24
- Owning issue: MOX-308

## Context

The latest and exact canonical order readers authorize one-use capabilities,
but their order branches inspect private Order Alerting and Event Routing
relations to prove the originating delivery. Passing the delivery tuple over
either public v1 HTTP API would change an established request contract.

## Decision

`warehouse-read-api` solely provides `momi.order_alert_delivery.v2` as the
exact command `momi_api.bind_order_alert_delivery_v2`. Only `order-alerting`
consumes it. This adds another `warehouse-read-api` to `order-alerting` edge,
matching the existing canonical read direction and introducing no cycle.

The command accepts one capability ID/token and one Event delivery tuple. It
binds only a same-transaction, active, unconsumed, unrevoked, unexpired v1 order
capability with the correct latest or exact-version shape. It atomically
upgrades the capability to v2 and stores the tuple in warehouse-owned private
authorization state. Replay, mismatch, stale state, and partial input fail
closed. Exact execution authority is granted only to `svc_order_alerting`.

A private Order Alerting wrapper invokes the byte-unchanged legacy issuer once
and the v2 binder once in one transaction. Only the worker switches to the
wrapper. Existing legacy rows are not backfilled.

Both warehouse order consumers lock local capability and binding state, mark
the capability consumed, and acquire the existing Event-owned order-alert
delivery witness in one statement transaction. Terminal local bindings are
redacted, expired bindings are pruned, and failed witness or read work rolls
back consumption. The latest reader retains its non-order `unbound` path
without a binding or witness call.

## Consequences

- Both public order-read v1 routes, schemas, responses, and token meaning stay
  unchanged and continue to reject undeclared delivery fields.
- Legacy v1 order bindings fail closed after cutover and expire within their
  existing 30-second lifetime; normal durable retry issues a new v2 binding.
- Warehouse-read no longer reads private Order Alerting or Event relations.
- Event Routing remains the sole delivery-lifecycle owner and exposes only its
  existing capability-bound witness.
- No cross-owner foreign key, relation grant, schema-wide usage, broad role,
  deployment, production mutation, or hosted identity claim is introduced.
