# Preorder Order Intent v1

## ELI5

Turns one valid quote into exactly one durable unpaid preorder.

## Trigger And Input

Authenticated `POST` with `X-MoMi-Checkout-Authority`.

## Output

An idempotent order receipt and private recovery authority.

## Side Effects

Commits window capacity and stores minimum contact/order evidence.

## Failure Handling

Fails closed for stale authority, quote, hold, version, or capacity.

## Tests

Lifecycle tests cover duplicate prevention, hold transfer, and recovery.
