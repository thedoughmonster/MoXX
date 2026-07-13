# Service Manifest v1

Each `services/<service-key>/service.json` is the enforceable authority record
for one cohesive business capability. It is validated against
`schemas/service-manifest-v1.schema.json`.

## Identity

- `service_key` is the stable directory and ownership key.
- `purpose` explains the capability in one sentence.
- `kind` is `source_adapter`, `core_capability`, or `destination_adapter`.
- `lifecycle_status` is `active`, `retiring`, or `retired`.
- `functions` lists every Edge Function slug owned by the service.

## Contracts

`contracts.provides` lists versioned public contracts owned by the service.
`contracts.consumes` identifies both provider and contract. Consumers may
import only a provider's declared public contract files, never implementation.
The architecture check rejects missing providers and dependency cycles.

## Authority

- `database.read` and `database.write` list allowed schemas or relations.
- `network.outbound_hosts` lists every permitted external host.
- `secrets` lists required secret names, never values.
- `runtime_dependencies` pins Deno-resolved runtime dependencies.
- `approved_packages` lists repository packages the service may import.

Empty authority arrays are deliberate and must remain present. New external
network authority, schema ownership, shared packages, services, and
cross-service contracts require an accepted ADR.

## Verification

Run `npm run check -- --service <service-key>` after changing a service or its
manifest. Run `npm run catalog:generate` when identity or ownership changes.
