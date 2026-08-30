# Function Capability Model v2

## Purpose and compatibility

Function Capability Model v2 preserves the v1 capability, provenance, ordering,
digest, and fail-closed semantics. It advances the closed projection only to
embed Architecture Snapshot Identity v2 after the MoXX cutover.

The top-level object is
`{$schema, schema_version: 2, source_snapshot, functions, digest}`. Its complete
source snapshot identifies `thedoughmonster/MoXX`, branch `dev`, and product
path `MoMi`. Function Manifest v1 adoption metadata remains unchanged.

All direct-capability, called-contract, transitive-effect, grant-boundary, and
diagnostic rules remain those defined by
[Function Capability Model v1](./function-capability-model-v1.md). A breaking
capability or derivation change requires a later model version and
architecture-contract version bump.
