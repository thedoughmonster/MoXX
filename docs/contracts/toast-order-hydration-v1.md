# Toast Order Hydration V1

## Purpose

This contract defines the only MoMi component allowed to fetch order business
data from the Toast source API. It hydrates warehouse snapshots from webhook or
scheduled work and never runs in response to a report or application read.

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

## Idempotency

Each hydration job has an explicit durable idempotency key containing the
configured source, resource kind, source record identity, and requested source
version or schedule window.

Only one active job may exist for an idempotency key. Retrying a failed or
interrupted attempt must not create a duplicate logical job or duplicate an
identical source snapshot.

A later source version or later configured schedule window is new work and may
create a new immutable snapshot for the same Toast order.

## Source Preservation

Each attempt records its job, start and finish times, outcome, HTTP status, and
safe error metadata. Secrets and authorization headers are never stored.

Successful hydration stores the complete source response body and non-secret
response metadata without dropping or renaming source fields. Any content hash
is additional ingestion metadata and never replaces the original response.

Raw snapshots are append-only. Corrections and re-hydration create later
snapshots rather than mutating the source document already received.

## Downstream Handoff

The hydration completion transaction stores the complete successful snapshot
and creates durable Order API invocation work atomically. That work contains the
order GUID and snapshot identity, never the order document.

A dedicated invoker calls the MoMi-owned Order API with the GUID. The Order API
resolves the current approved order through its versioned warehouse view.
Retries are idempotent, and the invoker cannot run before the transaction commits.

## Warehouse Reads

Hydration state and raw snapshots remain private. Explicitly named, versioned
views select approved projections and the current snapshot using documented
ordering rules.

Views expose freshness metadata such as retrieval time, source update time when
available, and stale status. They do not perform network calls.

Reports, clients, decision services, and delivery services read those views only
through the MoMi-owned API. No read request triggers hydration or calls Toast.

## Failure Behavior

A source outage or rate limit records a failed attempt and leaves the most recent
successful snapshot available. Configured retry work may run later.

Partial or malformed responses are preserved with their attempt metadata but do
not replace the current successful snapshot unless the explicit view contract
allows that outcome.

## Non-Goals

- No report-time or request-time source calls.
- No direct access from clients to Toast or raw warehouse tables.
- No business decisions or Slack delivery.
- No code-owned schedules, source mappings, or freshness thresholds.
