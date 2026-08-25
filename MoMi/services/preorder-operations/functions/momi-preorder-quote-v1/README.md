# MoMi Preorder Quote v1

## ELI5

The browser asks, “What would this exact box cost for this pickup date?” This
function asks the preorder owner, which checks the current menu, configured
pricing, requested allergen avoidance, and remaining capacity before returning
one short-lived receipt.

## Trigger And Input

Anonymous bounded `POST /functions/v1/momi-preorder-quote-v1`. `OPTIONS` is
supported for browser preflight.

## Output

Input and output are frozen by `contracts/input.schema.json` and
`contracts/output.schema.json`. The request contains only cart, version,
pickup-window, and allergen-selection data. Success returns an idempotent quote,
shop comparison, total savings, quantity progress, and a short-lived checkout
authority. Customer-safe 409/422/429 errors direct refresh or recovery.

## Side Effects

The owner refreshes the versioned fourteen-day window horizon and persists an accepted
quote once per command ID. Quotes do not reserve capacity.

## Failure Handling

Database failure is `503`; stale or unsafe business state fails closed with a
typed customer-safe response and is never inferred.

## Tests

`SUPABASE_DB_URL` is the only secret. Unit tests cover request parsing,
idempotent envelopes, typed failures, preflight, and rate limiting. Migration
tests pin private storage, version checks, configured adjustment boundaries,
price floors, capacity, and fail-closed allergen-avoidance enforcement. General
carts with an empty avoidance list may retain explicitly unverified data and
make no safety claim.
