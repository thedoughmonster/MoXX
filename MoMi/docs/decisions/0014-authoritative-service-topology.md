# 0014: Authoritative Service Topology

- Status: accepted
- Date: 2026-07-17

## Context

ADR `0013` defines one dataset owner, contract-only cross-service access, and
reference-only event routing. The current services predate that constitution.
Their manifests omit service types, several schemas have multiple writers, and
ADRs `0010` through `0012` combine archive, evaluation, and staging ownership.

## Decision

MoMi will use this target topology:

| Service | Type | Owned dataset |
| --- | --- | --- |
| `communications-archive` | `raw_evidence_archive` | Generic JSON evidence |
| `communications-evaluation` | `dataset_owner` | Communication evaluation |
| `momi-event-routing` | `event_router` | Event routing operations |
| `order-alerting` | `dataset_owner` | Order alert decisions |
| `slack-order-delivery` | `destination_adapter` | Slack delivery operations |
| `toast-data-acquisition` | `procurement_adapter` | Acquisition control |
| `toast-order-hydration` | `procurement_adapter` | Legacy hydration control |
| `toast-order-ingest` | `procurement_adapter` | None |
| `toast-stock-ingest` | `procurement_adapter` | None |
| `toast-webhook-ingestion` | `procurement_adapter` | None |
| `toast-order-read-api` | `read_facade` | None; retire after caller proof |
| `warehouse-projection` | `dataset_owner` | Canonical warehouse |
| `warehouse-read-api` | `read_facade` | Read authorization operations |
| `runtime-registry` | `dataset_owner` | Runtime registry |
| `archive-governance` | `dataset_owner` | Archive governance |
| `legacy-recipe-transform` | `transform` | Legacy transform operations |

`communications-archive` becomes the generic raw JSON evidence archive. Its
historical name may remain during migration, but source-specific adapters must
capture through its versioned contracts. It owns evidence and provenance, not
evaluation decisions. `communications-evaluation` receives the evaluator,
leases, derived records, corrections, and evaluation audit state.

Non-JSON sources first pass through a specialized transform. The transform
preserves source bytes and provenance, emits archive-ready JSON evidence, and
does not assign domain meaning. `legacy-recipe-transform` replaces permanent
warehouse ownership of `legacy_recipe_staging` and is transitional until the
generic archive contains the preserved evidence.

The event router owns event storage, subscriptions, queues, retries, delivery,
and dead lettering. Event producers own event meaning and payload schemas.
Events carry immutable evidence or dataset references, never copied source
payload ownership.

Procurement services own external-source access. They may own one coherent
operational control dataset, but never raw/domain datasets or MoMi-owned calls.
Destination adapters and read facades may likewise own one operational dataset.

Manifest deployment authority includes database processors, cron jobs, queues,
event subscriptions, PostgreSQL extension dependencies, and Vault secret-name
dependencies. Database-only owners use an empty Edge Function list.

## Transition

Target ownership is declared before runtime cutover. Existing direct private
access is removed behind owner contracts in additive waves. Service roles and
grants are introduced only after callers are proven on those contracts, then
broad access is revoked last.

This ADR supersedes only the service-ownership assignments in ADRs `0010`,
`0011`, and `0012`. Their immutability, staging safety, evaluator failure
policy, and activation controls remain accepted.

## Consequences

- Every permanent dataset and operational unit has one declared owner.
- Raw JSON evidence uses one generic archive boundary.
- Evaluation, routing, projection, and delivery remain separate capabilities.
- Repository declarations can harden before database permissions change.
- Runtime-role enforcement remains a later migration and hosted attestation.
