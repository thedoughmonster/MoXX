# 0003: Use Warehouse-First Data Access

- Status: accepted
- Date: 2026-07-12

## Context

Direct source API reads create hidden dependencies, inconsistent results,
uncontrolled cost, and business behavior that cannot be reproduced from stored
data. Direct HTTP calls between backend modules create similar coupling and can
lose work between acknowledgement and processing.

MoMi must retain Toast history after the planned move to Square. Toast cannot
remain a dependency for rebuilding data or answering historical questions.

## Decision

The warehouse is MoMi's system of record for source and business data.

Source acquisition uses inbound webhooks, files, approved warehouse loads, or
explicit primitive source functions processing durable work. For the first
order-alert slice, `toast.orders.fetch_by_guid.v1` is the only function allowed
to call Toast. It implements one operation and cannot proxy arbitrary requests.

Hydration and re-hydration begin from durable scheduled work. Schedule,
freshness windows, retry policy, and concurrency are database configuration.
Every attempt and complete source resource is stored before exposure. Retries
collapse under an explicit idempotency key.

An order webhook transaction stores the event payload unchanged and creates
durable hydration work before acknowledging Toast. The event remains separate
from the complete order later fetched using its order GUID.

Raw records are permanent and grouped by source resource type. Each row in
`toast_raw.orders` contains one complete order JSONB resource version plus
small identifying and retrieval metadata. A deterministic content hash avoids
storing the same version twice while fetch attempts retain observation history.

GET-by-GUID and any later approved bulk order primitive write through the same
`toast_raw.orders` resource contract. Endpoint-specific order stores are not
allowed. Related and query-oriented projections must be rebuildable from these
raw versions with all Toast credentials and network access removed.

The hydration completion transaction stores the resource version and creates
durable Order API invocation work atomically. A dedicated invoker later passes
identity only to the MoMi API, which resolves approved warehouse projections.

Scheduled hydration and re-hydration use the same job and resource-version path
as webhook-triggered hydration. They do not implement a parallel write path.

MoMi application, decision, reporting, API, and delivery code must not fetch
business data from source or vendor APIs. A read request never triggers or waits
for hydration; it returns the latest warehouse state with freshness metadata.

Internal modules coordinate through durable warehouse records. A Supabase-native
trigger adapter may invoke an allowlisted Edge Function after work commits, but
the call carries work identity only. It is a wake-up mechanism, not module state
or completion authority. Duplicate or missed calls reconcile from durable work.

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
- Complete Toast resources remain permanently preserved and private.
- Toast projections remain rebuildable after Toast access ends.
- Square can use parallel raw tables without erasing Toast provenance.
- Views become reviewed data contracts rather than convenient ad hoc queries.
- The MoMi API is the single application-facing data boundary.
- Reports remain available when source APIs are unavailable.
- Freshness is explicit instead of hidden behind request-time fetching.
- Webhook, scheduled, and retry hydration share one idempotent workflow.
- Ingestion remains fast and cannot fail because downstream processing is down.
- Pending work needs a warehouse-backed worker or scheduler before automation.
