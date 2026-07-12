# MoMi Order API V1

## Purpose

The MoMi Order API is the only application-facing boundary for order reads.
It resolves orders from an approved, versioned warehouse view and never calls
Toast or reads a raw source table directly.

## Input

The order lookup input is the non-empty Toast order GUID captured from the
configured webhook payload path. Callers pass identity only, never an order
document received from Toast.

The exact HTTP route and authentication contract must be fixed before the API is
implemented. They may not be inferred or duplicated by callers.

## Warehouse Contract

The API reads one explicitly named versioned order view. That view owns:

- Selection of the current successful full-order snapshot.
- Documented ordering and tie-breaking rules.
- Approved order projections and joins.
- Retrieval time and source update time when available.
- Freshness or stale status.

The view uses `security_invoker = true` and remains inaccessible to public,
anonymous, and authenticated database roles unless a later access contract adds
specific grants and row-level policies.

## Behavior

A read returns the latest approved warehouse representation available for the
GUID. It does not trigger hydration, wait for Toast, or silently fall back to a
source API.

After hydration commits, durable invocation work may ask a dedicated invoker to
call this API with the GUID. Its idempotency key includes the GUID, snapshot
identity, and API contract version.

## Failure Behavior

Unknown orders return a not-found result. Missing or stale data remains explicit
in the response contract. Source API availability does not alter API behavior.

## Non-Goals

- No direct Toast calls.
- No raw-table reads.
- No request-time hydration.
- No order mutation, eligibility decision, or Slack delivery.
