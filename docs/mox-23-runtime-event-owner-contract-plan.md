# MOX-23 Runtime and Event Owner-Contract Implementation

## Result

This L2 repository slice implements 25 of the 35 private-access findings inventoried at
base `45c91bc4ee06ab3c476d8251f6834699ccff8e6a`. The remaining 10 findings are recorded
exactly in `docs/mox-23-runtime-event-access-inventory.json` and remain removal-only debt.
No provider, credential, hosted runtime, production, deployment, or external configuration
was changed.

## Implemented owner contracts

Runtime Registry provides `momi.runtime.active_trigger_resolution.v1`. Fixed routines
resolve the active worker route for communications evaluation, event routing, order alerts,
Slack delivery, and warehouse projection. The bounded
order-reader resolver accepts only the supported contract key. Every resolver pins the
function owner, trigger key, contract version, function and trigger type, method, relative
route, authentication policy, and active state; ambiguity or drift returns no row.

MoMi Event Routing retains `momi.events.append.v1` and
`momi.events.delivery_lifecycle.v1`, and adds:

- `momi.events.delivery_reference.v1` for fixed reference-only order-alert and warehouse
  delivery reads;
- `momi.events.delivery_witness.v1` for exact live capability witnesses and the fixed
  order-alert wake authorization check;
- `momi.events.warehouse_delivery_reservation.v1` for warehouse claim/reservation state
  owned by the router; and
- `momi.events.warehouse_append.v1`, an 11-argument reference-only warehouse append with
  strict dataset-reference replay identity for the remaining producer cutovers. A repeat
  observation of one unchanged entity version preserves its first event metadata and the
  pre-cutover type-specific `observed` identity is accepted as the same event.

Communications Archive provides `toast.archive.warehouse_projection_input.v1` for one
exact webhook or resource-observation projection input. Toast Data Acquisition provides
`toast.acquisition.projection_job_mode.v1` for the corresponding job mode. These bounded
owner reads replace Warehouse Projection access to private raw and acquisition relations.

Event routines are `SECURITY DEFINER` with an empty search path, qualified objects, and
exact routine grants. Lifecycle behavior retains the 120-second lease, 12-attempt ceiling,
rotating capability checks, queue deletion, retry, and dead-letter behavior. Warehouse
reservations are inserted before HTTP capability rotation; internal reservations retain
the current token and therefore do not fire the HTTP trigger. Both reservation wrappers
require the existing `edge` processor mode, so database mode cannot create Edge work.
Projection and
acknowledgement atomically re-read the capability-bound owner reference, so both database
and Edge paths retain the Toast source-system and `source.toast.*` event fence.

## Identity boundary

The manifests declare narrow `NOLOGIN svc_*` capability roles for static ownership and
grant validation. Current hosted Edge workloads still share the project-level
`SUPABASE_DB_URL` trust root, so this repository slice does not claim per-service caller
identity isolation. Dedicated non-superuser connection identities and isolated secret
binding are follow-up hardening requiring separate credential/runtime authority.

The current schema declarations also do not provide sole authority for schema-wide
`USAGE` on any owner schema in this slice; only exact routine `EXECUTE` grants are
included. Schema activation remains separately owned follow-up work rather than
broadening this slice.

## Completed cutovers

The slice replaces or removes private Runtime Registry access in the affected fixed wake
adapters and TypeScript claim paths. Procurement wake adapters use their exact owned
deployment routes and retain no MoMi-owned service dependency. The slice also routes the bounded order-alert wake,
warehouse claim/process/reference/witness/ack/reservation paths through Event Routing owner
contracts, removes the migration-only readiness view, and ratchets the 25 resolved
fingerprints out of the baseline.

## Deferred residuals

The 10 residual findings are:

- three order-alert staging/capability reads whose active definitions also contain
  unrelated cross-owner writes;
- two warehouse-read capability rechecks that do not retain the delivery capability token;
- one warehouse projector event read whose current signature lacks the delivery witness;
- three warehouse event producer inserts awaiting bounded consumer cutovers to
  `momi.events.warehouse_append.v1`; and
- the procurement-owned daily stock snapshot append, which cannot consume a MoMi contract
  under the current service boundary.

The two corrected warehouse projectors use static event identities and the declared
warehouse append contract. Their prior private relation and event-write identities are
removed from the baseline only after the owner-routine cutover eliminates them.

## Rollback

All changes are additive owner migrations plus consumer-specific replacement migrations.
Before deployment, rollback is the ordinary code revert. After a migration is applied,
rollback must be a new owner migration restoring only the prior routine definition; do not
edit applied migrations, replay events, widen schema/table access, or discard deliveries,
queue identities, attempts, leases, capabilities, retries, or dead letters.
