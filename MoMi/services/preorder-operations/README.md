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
capacity, configured pricing, and the caller's allergen-avoidance request.
Hold and order-intent routes persist capacity and recovery state. The payment
boundary durably claims one exact attempt before provider work, freezes its
money, location, order, quote, and accepted-policy evidence, and projects only
sanitized financial observations into customer-safe preorder status.

Square owns payment and financial facts. This service exposes a customer-safe

The payment initiation and reconciliation Edge handlers compose only the
declared Square public contract modules in-process. Initiation removes the
single-use source token before durable claim work, calls Square only for one
owner-issued claim, and projects ambiguity as indeterminate. Reconciliation
retrieves only a known provider identity. The Square webhook handler verifies
exact bytes through the acquisition contract, archives authenticated raw
evidence, then resolves and projects one exact attempt.
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

`local:preorder-config` validates a versioned JSON configuration, prints an
exact digest and target summary by default, and requires an interactive exact
confirmation before calling the private owner routine. The selected environment
must match its pinned Supabase project, and the database URL is independently
bound to that project with verified TLS. Draft publications are
audited but never enable a customer surface. Active schema-version-three
publication requires a complete seven-day pickup mapping, fixed local cutoff,
capacity, flat prices and floors, explicit item eligibility, and disabled
advance/quantity discount arrays. Unverified allergen status remains visible
and is not a launch claim or admission requirement. Inactive publication
provides a versioned first-activation rollback, and restoring accepted values
uses a fresh `publication_ref`; every transition remains monotonic and
receipt-backed.

Execution additionally requires `--release-receipt` for the exact successful
development release. The tool rejects any tree other than clean canonical
`dev`, records a private operator receipt under `.momi/preorder-config/`, and
verifies the publication, normalized policy rows, surface state, and fourteen
current windows in the same transaction before commit.

Configuration schema version two normalizes authoring policy into immutable,
publication-bound price-class and item-policy relations. Each item declares a
direct class or the uniquely highest doughnut class, an administrative
`preorder_enabled` override, and one explicit eligibility mode with its exact
date shape. The published catalog stores the resolved class and quote-time
eligibility is evaluated against the requested pickup date. Version-one
publication receipts remain replayable and rollback-compatible. Schema version
three adds publication-bound ISO-weekday pickup mappings. Concrete windows keep
their policy version so later publications cannot rewrite frozen quote or order
evidence. The launch maps weekdays to 07:00–14:00, weekends to 08:00–14:00,
and computes the cutoff from versioned data as 17:00 local on the prior day.

## Quote authority

The quote route accepts no customer identity or payment data. The database
locks one command identity, refreshes the exact fourteen-day window horizon,
checks current configuration and item versions, and persists the accepted
receipt. A replay of identical cart data returns the same quote; reuse of the
command for different data fails closed. Configured quantity and advance
adjustments round in the customer's favor but never cross an item's configured
price floor. The launch has no such discount tiers, and every accepted unit is
at or below its in-shop comparison price. Unverified items may be quoted only
for an empty avoidance list; requesting avoidance without evidence remains fail
closed. A quote does not reserve capacity; issue #273 owns the later bounded
checkout hold.
