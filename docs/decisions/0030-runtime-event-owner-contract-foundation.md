# 0030: Runtime and Event Owner-Contract Foundation

- Status: accepted
- Date: 2026-08-23

## Context

ADRs `0013` and `0014` require versioned owner contracts while private Runtime
Registry and Event Routing relations remain implementation details. The first
MOX-23 cutover wave replaces 25 proven private accesses, but its cross-service
interfaces and permission boundary need an explicit decision record.

Ten separately owned private-access findings remain transition debt. Hosted
Edge functions also continue to share the project database trust root.

## Decision

The following owner contracts are accepted for this additive cutover:

| Owner | Contract | Boundary |
| --- | --- | --- |
| `runtime-registry` | `momi.runtime.active_trigger_resolution.v1` | Fixed active trigger and route resolution |
| `momi-event-routing` | `momi.events.delivery_reference.v1` | Capability-bound reference-only delivery reads |
| `momi-event-routing` | `momi.events.delivery_witness.v1` | Exact live delivery witnesses and wake authorization |
| `momi-event-routing` | `momi.events.warehouse_delivery_reservation.v1` | Bounded projection claim and reservation state |
| `momi-event-routing` | `momi.events.warehouse_append.v1` | Reference-only warehouse event append |
| `communications-archive` | `toast.archive.warehouse_projection_input.v1` | Exact archived Toast projection inputs |
| `toast-data-acquisition` | `toast.acquisition.projection_job_mode.v1` | One acquisition job mode |

Provider manifests map each contract to exact owner routines. Consumers may
call those declared routines but may not read or write the provider's private
relations. Contract routines use empty search paths and qualified objects.

Static `NOLOGIN svc_*` roles and exact routine `EXECUTE` grants express the
database-native capability boundary. This decision grants no schema-wide
authority and does not claim hosted workload identity isolation.

Warehouse projection must verify the capability-bound Toast event reference in
the same transaction that projects and acknowledges it. The warehouse append
contract rejects changes to stored dataset identity and reference fields. A
repeat observation of one unchanged canonical entity version returns the first
event and preserves its occurrence and correlation metadata; a pre-cutover
type-specific `warehouse.<entity_type>.observed` name is the same event as the
source-neutral `warehouse.entity.observed` identity for that exact version.

The deterministic MOX-23 inventory is the cutover proof. Only findings whose
source access is absent may leave the removal-only baseline. The ten remaining
findings stay visible for sibling work.

## Consequences

- Consumers use narrow owner interfaces without exposing private relations.
- Exact grants can ratchet independently of hosted credential hardening.
- Unchanged entity-version re-observation and pre-cutover events remain
  idempotent without weakening other append replay checks.
- This decision does not authorize deployment, runtime mutation, provider or
  secret changes, schema ownership changes, or the ten residual cutovers.
