# Service Manifest v1

Each `services/<service-key>/service.json` is the enforceable authority record
for one cohesive capability. It is validated against
`schemas/service-manifest-v1.schema.json`.

## Identity

- `service_key` is the stable directory and ownership key.
- `purpose` explains the capability in one sentence.
- `lifecycle_status` is `active`, `retiring`, or `retired`.
- `functions` lists every Edge Function slug owned by the service.
- `service_type` uses the seven types accepted by ADR `0013`.

`functions` may be empty for a database-only owner or a fully retired service.

The legacy `kind` remains deployment/catalog metadata. A
`procurement_adapter` uses `source_adapter`, a `destination_adapter` uses
`destination_adapter`, and every other `service_type` uses `core_capability`.
Every service declares `service_type`; the historical bootstrap allowance is
empty and recurrence is rejected.

## Dataset Authority

A service may declare `owned_dataset` as one object rather than a list, but it
must first declare `service_type`. A `dataset_owner` must declare the object;
other state-owning types may use it for their constitution-defined state. It has:

- one canonical dotted `dataset_key`;
- optional `private_schema` and `db_role` declarations;
- exact `schema.relation` entries in `private_relations`;
- versioned contract keys ending in `.vN` for `public_reads` and
  `public_commands`;
- exact event keys in `emitted_events`.

Dataset keys, database roles, private schemas, private relations, contract
providers, and event producers are globally unique when declared. A private
relation cannot be claimed inside another service's declared private schema.
Every public read or command must also appear in the owner's
`contracts.provides`. Database roles are validated when present but become
mandatory only with the later role-and-grant migration.

The constitution replays ordered migration DDL and requires every current
application table and view to appear in exactly one `private_relations` set.
Renames, schema moves, drops, and replacements are applied in migration order.
This proves declaration completeness and uniqueness. It does not attest hosted
roles, grants, or removal of the transition-period direct accesses identified
by ADR `0014`.

## Contracts

`contracts.provides` lists versioned public contracts owned by the service.
`contracts.consumes` identifies both provider and contract. Consumers may
import only a provider's declared public contract files, never implementation.
The checks reject duplicate providers, missing providers, and dependency
cycles.

## Authority

- `database.read` and `database.write` list allowed schemas or relations.
- `network.outbound_hosts` lists every permitted external host.
- `secrets` lists required secret names, never values.
- `runtime_dependencies` pins Deno-resolved runtime dependencies.
- `approved_packages` lists repository packages the service may import.

Empty authority arrays are deliberate and must remain present. New external
network authority, schema ownership, shared packages, services, and
cross-service contracts require an accepted ADR.

## Deployment And Configuration

`deployment.owns` declares exact operational units owned by the service:
database processors, cron jobs, queues, and event subscriptions. Each declared
unit has a typed `kind` and stable `key`, and no two services may own the same
unit. `deployment.depends_on` declares shared PostgreSQL extensions and exact
Vault secret names without assigning ownership of that infrastructure.

`configuration` lists non-secret runtime settings separately from `secrets`.
These fields remain optional during the constitution bootstrap, but a new
database-only service uses an empty `functions` list and declares its owned
operational units before implementation.

## Verification

Run `pnpm constitution:check` for the ownership law and
`npm run check -- --service <service-key>` for the complete service gate. Run
`npm run catalog:generate` when identity or function ownership changes.
