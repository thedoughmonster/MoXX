# Preorder Checkout Hold v1

## ELI5

Temporarily reserves the quoted doughnut quantity while checkout continues.

## Trigger And Input

Authenticated `POST` with `X-MoMi-Checkout-Authority`.

## Output

An idempotent customer-safe hold receipt or typed error.

## Side Effects

Creates, recovers, releases, or expires one bounded capacity hold.

## Failure Handling

Fails closed for invalid authority, stale/expired quotes, or unavailable capacity.

## Tests

Handler and migration lifecycle tests cover authorization and idempotency.
