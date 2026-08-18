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

Its database-only private implementation consists exactly of:

- `momi_runtime.function_parameter_map`
- `momi_runtime.function_registry`
- `momi_runtime.function_trigger_registry`

There are no current functions, provided or consumed contracts, public reads,
public commands, events, hosted routes, deployment units, or accepted
service-client roles. The manifest declares no `db_role`, and current database
revokes do not establish a service-specific role or grant.

Existing direct readers of the private relations remain removal-only legacy
debt. They are not public consumers and authorize no new reader.

Any future interface requires a separately accepted versioned owner contract,
caller compatibility and cutover, defined failure semantics, verification, and
separately authorized role and grant work.
