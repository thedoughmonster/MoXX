# Preorder Operations

## ELI5

This service is the shop clerk for online preorders. It tells the customer what
can be ordered and when, checks the exact price, remembers one order safely,
and reports what happens next. Square handles the money; this service never
handles the card.

## Boundary

preorder-operations owns Dough Monster's public preorder business lifecycle:
surface configuration, announced catalog policy, fulfillment eligibility,
capacity, quotes, holds, order intents, customer-safe status, and change
requests.

The browser uses only the versioned Edge Function routes declared in
contracts/preorder-public-v1.openapi.json. The first implementation slice owns
the private `momi_preorder` schema and exposes the customer-safe bootstrap read
through `momi-preorder-bootstrap-v1`. `momi-preorder-quote-v1` creates durable,
idempotent quote receipts from the current versions, fourteen-day window,
capacity, allergen evidence, and configured 2/5/10-day plus quantity savings.
Hold and order-intent routes persist capacity and recovery state. The payment
boundary durably claims one exact attempt before provider work, freezes its
money, location, order, quote, and accepted-policy evidence, and projects only
sanitized financial observations into customer-safe preorder status.

Square owns payment and financial facts. This service exposes a customer-safe
payment workflow but has no direct Square network or secret authority. Square
adapters introduced under issue #162 must preserve that separation.

## Payment attempt boundary

`claim_payment_attempt_v1` creates one owner-issued attempt and an expiring
execution claim without receiving or storing the Square-hosted source token.
Duplicate initiation cannot reacquire paid work; an expired initiate claim
becomes indeterminate and must reconcile. `claim_payment_reconciliation_v1`
permits repeatable provider reads only when a known provider identity exists.
`project_payment_evidence_v1` deduplicates canonical evidence, checks the exact
order, money, currency, location, provider identity, and provider timestamp,
then applies only an allowed lifecycle transition. Missing, mismatched,
conflicting, or disordered evidence fails closed without inventing payment
success or fulfillment truth.

## Configuration publication

`local:preorder-config` validates a version-one JSON configuration, prints an
exact digest and target summary by default, and requires an interactive exact
confirmation before calling the private owner routine. The selected environment
must match its pinned Supabase project, and the database URL is independently
bound to that project with verified TLS. Draft publications are
audited but never enable a customer surface. Active publication fails unless
the 14-day policy, 2/5/10-day tiers, quantity savings, capacity, verified
allergens, price floors, and preorder-below-shop rule are complete. Replaying
the same digest is idempotent. Rollback copies previously accepted business
values under a fresh `publication_ref`, creating a new monotonic version while
preserving both receipts.

## Quote authority

The quote route accepts no customer identity or payment data. The database
locks one command identity, refreshes the exact fourteen-day window horizon,
checks current configuration and item versions, and persists the accepted
receipt. A replay of identical cart data returns the same quote; reuse of the
command for different data fails closed. Quantity and advance savings round in
the customer's favor but never cross an item's configured price floor, and
every accepted unit remains below its in-shop comparison price. A quote does
not reserve capacity; issue #273 owns the later bounded checkout hold.
