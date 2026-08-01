# Preorder Order Status v1

## ELI5

Shows the durable customer-safe state of one preorder after reconnect or refresh.

## Trigger And Input

Authenticated `GET` with `X-MoMi-Recovery-Authority` and `order_id`.

## Output

Current order, latest payment-attempt identity, payment, fulfillment, window,
total, and allowed actions. The attempt identity is null until payment starts
and is always present when reconciliation is authorized.

## Side Effects

None.

## Failure Handling

Invalid or mismatched authority is indistinguishable from a missing order.

## Tests

Handler and migration tests cover safe recovery and action projection.
