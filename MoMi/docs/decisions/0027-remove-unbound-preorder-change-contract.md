# 0027: Remove unbound preorder change contract

- Status: accepted
- Date: 2026-08-18
- Owning issue: #589 / MOX-235
- Partially supersedes: ADR 0019

## Context

ADR 0019 included `momi.preorder.change_request.submit.v1` in the intended
version-one preorder surface. The service manifest and public OpenAPI repeated
that declaration, but the repository and hosted development environment have
no accepted structural implementation binding, route, routine, relation, or
Edge Function for it.

Publishing the declaration makes an unavailable self-service capability appear
callable. The active preorder surface already fails closed: customers must
contact the shop, and both customer self-service flags are disabled.

## Decision

Remove `momi.preorder.change_request.submit.v1`, its OpenAPI route, and its
request, response, and orphaned error schema from current executable
architecture surfaces. Keep preorder cancellation and modification disabled in
checked-in active configuration and customer-facing fixtures, with guidance to
contact Dough Monster.

This decision partially supersedes ADR 0019 only for the unimplemented
change-request declaration. It does not erase the historical intent or alter
the implemented preorder, payment, recovery, order-status, or internal
lifecycle contracts.

## Future design gate

Future self-service preorder changes require a separately accepted design,
versioned compatibility choice, exact provider-owned callable binding, caller
policy, safe failure, rollback, and hosted proof before publication.

## Compatibility and rollback

Runtime behavior is unchanged because no change-request route is hosted.
Clients generated from the premature OpenAPI declaration may lose a compile-time
operation; that is an intentional fail-closed correction of an unavailable
route.

Rollback is the exact inverse repository change. Reintroducing the declaration
without the future design gate and callable binding would recreate the defect.
