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
must first declare `service_type`. Dataset owners, raw archives, and event
routers must declare the object; other specialized types may own only bounded
operational state. It has:

- one canonical dotted `dataset_key`;
- one `dataset_class`: `domain`, `operational`, or `raw_evidence`, constrained
  by `service_type`;
- optional `private_schema`, `private_schemas`, and `db_role` declarations;
- exact `schema.relation` entries in `private_relations`;
- exact schema-qualified names for every active routine in `private_routines`;
- versioned contract keys ending in `.vN` for `public_reads` and
  `public_commands`;
- optional `public_relation_reads` mappings from an exact owned versioned view
  to one contract already listed in `public_reads`;
- optional `public_routine_commands` mappings from a schema-qualified private
  routine name to one contract already listed in `public_commands`;
- optional `public_routine_reads` mappings from a schema-qualified private
  routine name to one contract already listed in `public_reads`;
- optional `dynamic_read_routines` binding one security-invoker query sandbox
  to its read contract, routine, consumer, non-login role, and allowed schema;
- exact event keys in `emitted_events`; dynamic identities are removal-only
  runtime debt, and new dynamic event names are rejected.

Procurement adapters may not consume MoMi-owned contracts. Transitional direct handoffs remain removal-only debt, not authorized dependencies.

`private_schemas` spans multiple exclusive schemas for one coherent dataset.
Dataset keys, roles, schemas, relations, contract providers, and event producers
are globally unique. A private relation cannot be claimed inside another
service's declared private schema.
Every public read or command must also appear in the owner's
`contracts.provides`. Database roles are validated when present but become
mandatory only with the later role-and-grant migration.

The constitution replays ordered migration DDL and requires every current table,
view, function, and procedure to have one declared owner. Renames, schema moves,
drops, and replacements apply in order. This proves declaration completeness
and uniqueness. It does not attest
hosted roles, grants, or removal of the transition-period direct accesses
identified by ADR `0014`.

Runtime TypeScript under every service directory and every active overload of
each migrated view or routine are scanned for exact relation references. A
cross-owner read is valid only when the owner maps that relation
to a public-read contract and the consumer declares the exact provider and
contract. Writes to another owner's relation and dynamic SQL identifiers are
never authorized by a public-read mapping. Historical occurrences live in the
separate removal-only service access debt baseline.

Cross-service routine calls require an exact routine-name mapping plus the
matching consumed provider contract. Ownership remains at the
schema-qualified routine name in version 1, while replay and body scanning use
canonical input signatures so overloads cannot hide one another. Role/grant
enforcement must add hosted signatures before runtime isolation is claimed.
Dynamic SQL remains rejected unless its routine is a declared public read, its
consumer declares the contract and role, and it checks that role plus a
read-only transaction. The declaration never permits writes or another routine.
New migrations assign index authority through the indexed relation, reject
unmodeled role ownership, use the same object rules, and may not
rewrite any migration after it lands on `dev`. Existing object authority and
history come from trusted `dev`, so transfers land as manifest-only changes
before a later migration may use the new owner.
## Contracts

`contracts.provides` lists versioned public contracts owned by the service;
`contracts.consumes` identifies provider and contract. Consumers may import
only declared contract files, never implementation. Checks reject duplicate or
missing providers and dependency cycles.

## Authority

- `database.read` and `database.write` list allowed schemas or relations.
- `network.outbound_hosts` lists every permitted external host.
- `secrets` lists required secret names, never values.
- `runtime_dependencies` pins Deno-resolved runtime dependencies.
- `approved_packages` lists repository packages the service may import.

Empty authority arrays are deliberate. New external network authority, schema
ownership, shared packages, services, and cross-service contracts require an ADR.

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
