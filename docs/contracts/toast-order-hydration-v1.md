# Toast Order Hydration V1

## Purpose

This contract defines the primitive source operation
`toast.orders.fetch_by_guid.v1`. It is the only function allowed to call Toast
for the first order-alert slice and never runs for a report or application read.

It implements only Toast's order GET-by-GUID operation. It accepts no arbitrary
URL, method, headers, or body and is not a generic Toast proxy. A future bulk
operation requires its own approved primitive contract.

## Scheduling

Hydration starts from durable warehouse work. Database configuration owns:

- Enabled state.
- Source and resource mapping.
- Refresh interval and freshness window.
- Initial lookback and reconciliation window.
- Retry and backoff policy.
- Concurrency and rate limits.

No schedule, source id, restaurant id, or business value is hardcoded in the
service. Recent or active orders may use a different configured cadence from
closed historical orders.

## Webhook Entry

The webhook transaction stores the complete event and creates hydration work
using the incoming Toast order GUID before the receiver acknowledges Toast.
The receiver itself does not call Toast or the MoMi API.

The hydration worker starts only after that transaction commits. Scheduled and
reconciliation jobs enter the same durable work table and execution path.

A Supabase-native trigger adapter may invoke the allowlisted Edge Function after
commit with the work id and private per-work capability token. The request is an
at-least-once wake-up signal only. The function verifies the token while it
claims durable work; reconciliation recovers missed or duplicate invocations.

## Idempotency

Each hydration job has an explicit durable idempotency key containing the
configured source, resource kind, source record identity, and requested source
version or schedule window.

Only one active job may exist for an idempotency key. Retrying a failed or
interrupted attempt must not create a duplicate logical job or duplicate an
identical resource version.

A later source version or later configured schedule window is new work and may
create a new immutable resource version for the same Toast order.

## Source Preservation

Each attempt records its job, start and finish times, outcome, HTTP status, and
safe error metadata. Secrets and authorization headers are never stored.

Successful hydration stores the complete source response body and non-secret
response metadata without dropping or renaming source fields. Any content hash
is additional ingestion metadata and never replaces the original response.

`toast_raw.orders` is the permanent raw resource table. Each immutable version
stores the complete order object as JSONB plus small metadata: restaurant id,
order GUID, operation key, observation time, and deterministic content hash.
The associated attempt separately records resolved input and response metadata.

The uniqueness scope includes source identity and content hash. An unchanged
response reuses its existing resource version while the fetch attempt records
the new observation. Changed content creates a new immutable version.

GET-by-GUID and any later approved bulk order primitive feed this same resource
table. Bulk retrieval must not create a second representation of Toast orders.

## Downstream Handoff

The hydration completion transaction stores the complete successful version
and creates durable Order API invocation work atomically. That work contains the
order GUID and resource-version identity, never the order document.

A dedicated invoker calls the MoMi-owned Order API with the GUID. The Order API
resolves the current approved order through its versioned warehouse view.
Retries are idempotent, and the invoker cannot run before the transaction commits.

## Warehouse Reads

Hydration state and raw resource versions remain private. Related and query
projections are derived only from owned raw JSONB and must rebuild successfully
with Toast credentials disabled and network access removed.

Explicitly named, versioned query contracts select approved projections and the
current resource version using documented ordering rules.

Views expose freshness metadata such as retrieval time, source update time when
available, and stale status. They do not perform network calls.

Reports, clients, decision services, and delivery services read those views only
through the MoMi-owned API. No read request triggers hydration or calls Toast.

## Failure Behavior

A source outage or rate limit records a failed attempt and leaves the most recent
successful resource version available. Configured retry work may run later.

Partial or malformed responses are preserved with their attempt metadata but do
not replace the current successful version unless the query contract allows it.

## Non-Goals

- No report-time or request-time source calls.
- No direct access from clients to Toast or raw warehouse tables.
- No business decisions or Slack delivery.
- No code-owned schedules, source mappings, or freshness thresholds.
- No assumption that Toast remains reachable after the Square transition.
