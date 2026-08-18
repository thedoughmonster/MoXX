# Service Dependency Graph v1

## Purpose

Service Dependency Graph v1 is the canonical, machine-readable projection of
declared service contract dependencies. It includes every valid service and
only edges declared by `contracts.consumes`; it never infers dependencies from
imports, database access, deployment metadata, or runtime observations.

## Shape And Direction

The closed top-level object contains `$schema`, `schema_version`, the complete
MOX-207 `source_snapshot`, `nodes`, `edges`, and `digest`. A node contains only
`service_key` and its exact `services/<service-key>/service.json` path. An edge
contains `provider`, `consumer`, `contract`, and both exact manifest paths.
Edges point provider to consumer. Their identity is the tuple
`[provider, consumer, contract]`.

Every provided contract identifier has exactly one provider across the whole
repository. Each consumed contract must name that existing provider and one of
its exact provided identifiers. Duplicate services, duplicate edge identities,
duplicate provided identifiers, unknown providers, missing provider contracts,
self-dependencies, and cycles are invalid and fail closed.

## Canonical Order And Digest

Nodes sort by `service_key`. Edges sort by `provider`, then `consumer`, then
`contract`. Ordering uses an explicit ascending UTF-16 code-unit comparison;
locale-sensitive comparison is forbidden. Input discovery order has no effect
on the graph bytes.

The top-level `digest` is lowercase SHA-256 over the existing `canonicalJson`
UTF-8 encoding of the complete graph after excluding only the top-level
`digest` property. `$schema`, schema version, source snapshot, nodes, edges, and
every nested property are covered. Canonical graph bytes have no trailing
newline.

## Validation And Assertion

The v1 JSON Schema closes every object, requires every field, pins both schema
versions, constrains identities and paths, and rejects malformed values. The
validation API also rejects duplicate or unsorted node and edge identities,
unknown nodes, path mismatches, self-dependencies, cycles, and digest mismatch.

The assertion API invokes the MOX-207 source snapshot assertion, rebuilds the
current graph through `validateArchitecture`, and compares the complete
projection. Schema, version, stale snapshot, digest, or payload drift fails
closed. Every diagnostic contains exactly `code`, `field_path`, `expected`, and
`actual`; diagnostics sort by field path, code, expected, then actual using the
same UTF-16 comparator.

## Output Boundary

The thin generator writes canonical bytes only to the ignored local path
`.momi/architecture/service-dependency-graph-v1.json`. No current graph is
checked in. Changing the shape, canonical order, digest semantics, or dependency
interpretation requires a new graph schema version.
