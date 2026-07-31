# Preorder Order Status v1

## ELI5

Shows the durable customer-safe state of one preorder after reconnect or refresh.

## Trigger And Input

Authenticated `GET` with `X-MoMi-Recovery-Authority` and `order_id`.

## Output

Current order, payment, fulfillment, window, total, and allowed actions.

## Side Effects

None.

## Failure Handling

Invalid or mismatched authority is indistinguishable from a missing order.

## Tests

Handler and migration tests cover safe recovery and action projection.
