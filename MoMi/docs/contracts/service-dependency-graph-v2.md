# Service Dependency Graph v2

## Purpose and compatibility

Service Dependency Graph v2 preserves the v1 node, edge, ordering, digest, and
fail-closed dependency semantics. It advances the closed projection only to
embed Architecture Snapshot Identity v2 after the MoXX cutover.

The top-level object is
`{$schema, schema_version: 2, source_snapshot, nodes, edges, digest}`. Its
complete source snapshot identifies `thedoughmonster/MoXX`, branch `dev`, and
product path `MoMi`. The generator writes canonical bytes to
`.momi/architecture/service-dependency-graph-v2.json`.

All provider/consumer direction, uniqueness, cycle, path, and diagnostic rules
remain those defined by
[Service Dependency Graph v1](./service-dependency-graph-v1.md). A breaking
dependency interpretation change requires a later graph version and
architecture-contract version bump.
