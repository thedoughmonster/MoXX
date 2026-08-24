# 0032: Atomic Stock-Snapshot Owner-Contract Cutover

- Status: accepted
- Date: 2026-08-24
- Owning issue: MOX-374

## Context

`warehouse_projection.project_toast_stock_snapshot` directly reads four
provider-owned relations and writes Event Routing's private event table. The
runtime-access ratchet hashes the full active routine definition. Replacing
only the event insert therefore makes all four unchanged read fingerprints
stale and creates four replacement findings.

PostgreSQL cannot replace one clause of a stored routine independently. The
event-only MOX-142 boundary is consequently not executable under the
removal-only debt baseline.

## Decision

One implementation package must add the provider reads and redefine the
consumer routine in this order:

1. `communications-archive` adds two routines to its accepted
   `toast.archive.warehouse_projection_input.v1` contract:
   - `toast_raw.read_stock_snapshot_attempt_v1(bigint)` returns the latest
     successful, finished array attempt's ID and timestamps;
   - `toast_raw.read_stock_snapshot_observations_v1(bigint)` returns every
     stock-state observation identity for the job, its projection eligibility,
     and only the item GUID fields needed for complete-snapshot inference.
2. `toast-data-acquisition` provides the new
   `toast.acquisition.stock_snapshot_projection_job.v1` contract through
   `toast_acquisition.read_stock_snapshot_projection_job_v1(bigint)`. It
   returns exactly job ID, operation key, status, mode, and restaurant GUID.
3. `warehouse-projection` redefines
   `warehouse_projection.project_toast_stock_snapshot(bigint, uuid)` to use
   those reads and the existing `momi.events.warehouse_append.v1` command.

The package declares the new routines and contract mappings in provider and
consumer manifests. Each owner creates only its own routine in a separately
owner-tagged migration. All three provider read routines are
`SECURITY DEFINER` with an empty search path and fully qualified objects. They
revoke execution from `public`, `anon`, `authenticated`, and `service_role`,
then grant only the exact routines to `svc_warehouse_projection`; focused tests
prove those privileges.

The final consumer migration removes these exact removal-only baseline
entries; it must not rewrite them:

| Fingerprint | Owner | Disposition |
| --- | --- | --- |
| `sha256:029e81ce343fd3419c41d992f0c9bd0bcf8f50e2e9659a18fba45787619db579` | `toast-data-acquisition` | replace `toast_acquisition.jobs` reads with the new exact job contract |
| `sha256:3d02cf5a9d73cfb119c07037259a02c51b0efa236e37cfd994560a7d2600d606` | `communications-archive` | replace `toast_raw.api_request_attempts` reads with the attempt/input routines |
| `sha256:7abd82ff7ab92c3e56a14f74da1bcc3f6398c864d993c51d36073f076d2a1532` | `communications-archive` | replace `toast_raw.resource_observations` reads with the observation input routine |
| `sha256:af62df77502ec1048f9bbdd06b205853a379ac8870791d6760c5aaddfd67b622` | `communications-archive` | replace `toast_raw.resource_versions` reads with the observation input routine |
| `sha256:3e000bd8611227c83d9c9739d3ebab48bc514d8f9027eebd800ba18bc4c99f33` | `momi-event-routing` | replace the event-table insert with `momi.events.warehouse_append.v1` |

The redefinition preserves:

- one canonical snapshot ID reused by job ID and one batch event after a
  non-empty projection;
- the operation/status fences and snapshot-only inference behavior;
- projection of every stock observation from a successful attempt while the
  absence test considers the complete job observation set;
- latest successful-array attempt selection and its event/observation timing;
- source observation keys, inferred source references, snapshot assignment,
  observation count, schema version, source identity, and correlation;
- idempotency key `warehouse:stock-snapshot:toast-job:<job_id>` and the owner
  append contract's duplicate/replay enforcement.

The package does not redefine `project_toast_stock_observation`, move its four
separate fingerprints, alter batching, or change archive/acquisition storage.

## Validation

A temporary three-migration proof with the declared manifest mappings passed
`pnpm migration:check`. `pnpm constitution:check` reported only the five exact
stock-snapshot entries above as stale, with no new or rewritten finding. Their
removal in the consumer cutover is therefore the complete constitution delta.

The provider routines compiled in PGlite and preserved latest-attempt
selection, the complete observation set, projection eligibility, invalid-item
identity, and the exact job envelope. Existing stock batching and warehouse
append behavior tests passed; the residual inventory test failed only because
the temporary proof intentionally removed `3e000bd8…` without updating its
hand-maintained expectations.

## Consequences

MOX-142 is superseded by one atomic implementation issue containing all three
owner migrations, manifest declarations, focused behavior coverage, exact
five-fingerprint removal, and debt evidence updates. That work removes the one
Event fingerprint from `docs/mox-23-runtime-event-access-inventory.json`,
changes its 27/8 implementation counts to 28/7 with corresponding summary
counts: seven fingerprints, six virtual subjects, five physical sources, three
consumers, seven Event-owned findings, one existing-contract disposition, six
missing-contract dispositions, and consumer counts of 3/1/3 for Order
Alerting/Toast Acquisition/Warehouse Projection. It updates the hard-coded
fingerprint groups/counts in
`tests/mox_23_runtime_event_access_inventory.test.ts`. It separately
regenerates the debt lifecycle trend and legacy access governance report from
the five-entry baseline reduction. Partial consumer redefinition remains
forbidden.

Before deployment, rollback is an ordinary code revert. After any migration is
applied, rollback requires new owner migrations; applied history, source data,
events, and debt entries must not be rewritten or deleted.
