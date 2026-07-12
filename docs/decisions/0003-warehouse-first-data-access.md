# 0003: Use Warehouse-First Data Access

- Status: accepted
- Date: 2026-07-12

## Context

Direct source API reads create hidden dependencies, inconsistent snapshots,
uncontrolled cost, and business behavior that cannot be reproduced from stored
data. Direct HTTP calls between backend modules create similar coupling and can
lose work between acknowledgement and processing.

MoMi already preserves complete source events in the warehouse. That durable
data should be the only input to decisions, reporting, and application reads.

## Decision

The warehouse is MoMi's system of record for source and business data.

Source acquisition uses inbound webhooks, files, approved warehouse loads, or a
dedicated hydration adapter processing durable work. It is the only component that
may fetch business data from a source API.

Hydration and re-hydration begin from durable scheduled work. Schedule,
freshness windows, retry policy, and concurrency are database configuration.
Every attempt and complete source response is stored before the data is exposed.
Retries collapse under an explicit idempotency key.

An order webhook transaction stores the complete event and durable hydration
work before acknowledging Toast. The hydration worker later fetches the full
order using the incoming GUID and stores an immutable source snapshot.

The hydration completion transaction stores the snapshot and creates durable
Order API invocation work atomically. After commit, a dedicated invoker passes
the GUID to the MoMi-owned Order API, which resolves the order through an
approved versioned view. It never trusts an order document from the invoker.

Scheduled hydration and re-hydration use the same job and snapshot path as a
webhook-triggered hydration. They do not implement a parallel write path.

MoMi application, decision, reporting, API, and delivery code must not fetch
business data from source or vendor APIs. A read request never triggers or waits
for hydration; it returns the latest warehouse state with freshness metadata.

Internal modules coordinate through durable warehouse records. They must not
chain work with direct HTTP or Edge Function-to-Edge Function calls.

The Order API invoker is a controlled boundary, not an in-request chain. It
starts only from committed work created by the hydration completion transaction.

Downstream read contracts are explicitly named and versioned database views.
Only the MoMi-owned API may expose those views to clients or other applications.
The API and application code must not query raw source tables directly.

A dedicated delivery adapter may call a configured destination API, such as
Slack, only to send a durable warehouse-owned outcome. It may not use that API
to fetch business data or make eligibility decisions.

Any exception requires a separate accepted ADR and explicit user approval.

## Consequences

- Every decision can be reproduced from durable warehouse state.
- Raw source structures remain preserved and private.
- Views become reviewed data contracts rather than convenient ad hoc queries.
- The MoMi API is the single application-facing data boundary.
- Reports remain available when source APIs are unavailable.
- Freshness is explicit instead of hidden behind request-time fetching.
- Webhook, scheduled, and retry hydration share one idempotent workflow.
- Ingestion remains fast and cannot fail because downstream processing is down.
- Pending work needs a warehouse-backed worker or scheduler before automation.
