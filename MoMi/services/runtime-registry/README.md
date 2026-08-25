# Runtime Registry

Owns the database registry that identifies deployable functions and triggers.

## ELI5

This is MoMi's switchboard record. It says which function and trigger identity
is current, where it routes, and whether it is active; it does not run the
business capability itself.

## Current boundary

Runtime Registry is active and implemented in the repository. Its derived
availability is `not_asserted`: repository implementation does not mean it is
hosted, reachable, callable, healthy, or operational.

Its database relations remain private implementation details:

- `momi_runtime.function_parameter_map`
- `momi_runtime.function_registry`
- `momi_runtime.function_trigger_registry`

## Public contract

`momi.runtime.active_trigger_resolution.v1` exposes fixed, non-enumerating
route resolvers. Five no-argument routines each resolve one named worker. The
order-alert reader resolver accepts only `momi.orders.get_by_id.v1`,
`momi.orders.get_by_version.v1`, or the transitional
`momi.toast_orders.get_by_id.v1` key.

Every resolver returns at most one `(contract_version, route_path)` row. It
returns no row unless the function and trigger are both active and exactly
match their v1 key, type, owner, method, route, and authentication policy. The
reader additionally requires `durable_http`; an incompatible legacy HTTP row
therefore stays closed. Calls are read-only, deterministic for one registry
snapshot, safe to retry, and have no replay or idempotency state.

The routines are `SECURITY DEFINER` with an empty search path and fully
qualified static SQL. Execution is revoked from `PUBLIC`, `anon`,
`authenticated`, and `service_role`, then granted only to each declared
consumer's non-login `svc_*` capability role. These roles identify database
capability ownership; shared Edge project credentials are not evidence of
per-workload identity. Credential isolation is follow-up hardening outside
this repository slice. Schema `USAGE` remains withheld; this slice grants only
exact routine execution and introduces no schema-wide authority.

Rollback is additive: revert consumers to their prior exact registry lookup
before a forward owner migration removes these wrappers. Registry data and
active routes are not rewritten by rollback.

## Tests

`tests/active_trigger_resolution_contract.test.ts` pins the provider manifest,
signatures, exact mappings, fail-closed gates, and privilege revocations.
