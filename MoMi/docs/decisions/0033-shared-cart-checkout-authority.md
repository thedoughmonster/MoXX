# 0033: Shared Cart and Checkout Authority

- Status: accepted
- Date: 2026-08-30
- Owning issue: MOX-439
- Extends: ADR 0013
- Partially supersedes: ADR 0019 for future shared cart and checkout authority

## Context

`preorder-operations` currently owns the implemented preorder quote, hold,
order-intent, order-status, payment-initiation, and reconciliation surfaces.
Other shopping entry flows need to converge on one cart and checkout without
copying those preorder-specific rules or creating parallel order identities.
ADR 0013 requires one dataset owner and versioned contract-only access.

## Decision

Declare `cart-checkout-operations` as the sole source-neutral logical owner of
shared draft-order, cart, checkout, recovery, and order-change-reference state
and contracts. One current cart is a customer-safe view of one current draft
order. Checkout continues on that same `order_id`; it never creates a second
cart or order identity.

The accepted version-one logical contract keys are:

- `momi.cart_checkout.draft_order.mutate.v1`
- `momi.cart_checkout.draft_order.read.v1`
- `momi.cart_checkout.flow_contribution.submit.v1`
- `momi.cart_checkout.flow_contribution.revalidate.v1`
- `momi.cart_checkout.cart.read.v1`
- `momi.cart_checkout.checkout.command.v1`
- `momi.cart_checkout.checkout.status.read.v1`
- `momi.cart_checkout.checkout.recover.v1`
- `momi.cart_checkout.order_change.reference.v1`

The machine-readable shapes live in
`services/cart-checkout-operations/contracts/cart-checkout-public-v1.schema.json`.
They are declared and non-callable: this decision creates no function, route,
relation, routine, subscription, deployment unit, or runtime writer.

## Ownership and one-writer boundary

Entry-flow services own eligibility, pricing, fulfillment, capacity, cutoff,
disclosure, and revalidation policy for their contributions. They submit typed
contributions with owner/version references and later answer revalidation
through their own versioned boundaries. They do not own a checkout path.

`cart-checkout-operations` owns draft identity, monotonic order versioning,
idempotent mutation semantics, cart presentation state, checkout progression,
recovery state, and reference-only order-change publication. It orchestrates
flow-owner revalidation but never reimplements flow policy.

Until separately authorized implementation and cutover work lands,
`preorder-operations` remains the only active writer of its existing dataset
and public version-one surface. Its seven active contract keys and route shapes
are not removed, renamed, or repurposed. Later adapters must be additive and
must prove one active writer before any surface transfers.

## Reference and privacy boundary

An order-change reference contains only immutable event/change/order identity,
the monotonic `order_version`, occurrence time, and a versioned owner-read
reference. The event router transports that reference. It never carries cart
lines, customer contact, payment material, credentials, provider payloads, or
policy bodies. Consumers resolve current state only through the owning read
contract, and delayed references cannot regress a newer projection.

## Customer-safe vocabulary

The canonical customer state vocabulary is `loading`, `empty`, `incomplete`,
`ready`, `invalid`, `stale`, `pending`, `declined`, `indeterminate`,
`recovery_required`, and `confirmed`. Provider ambiguity is always
`indeterminate`, never confirmation or permission for a blind payment retry.

## Consequences

- Preorder, catalog, event/menu, and direct-link entry flows share one contract
  family and one future order/cart identity.
- This manifest-first declaration lets backend and MoXi work against synthetic
  fixtures without claiming that a callable service exists.
- Durable state, payment execution, event subscription, provider configuration,
  deployment, and production activation require later authorized issues.
