# Function Capability Model v1

## Purpose and authority boundary

This contract separates a function's direct non-contract capabilities, its
exact direct contract calls, and analysis-only effects behind those contracts.
It never creates authority. A reviewed
[Execution Authority v1](./execution-authority-v1.md) declaration remains the
only positive grant, and this model can only subtract from that grant.

Function Manifest v1 opts in with:

```json
{"capability_model":{"schema_version":1,"called_contracts":[]}}
```

Absent metadata remains manifest-valid during staged adoption. Consumers emit
`capability_model_absent`; they must not claim repository completeness or use
the absent function as positive grant evidence. Present metadata is strict and
has no import, source-code, runtime, observation, or debt fallback.

## Three non-overlapping namespaces

1. `required_capabilities` is the direct non-contract source for an opted-in
   function. V1 accepts only `database_read` and `database_write`. These map to
   the matching database namespace ceiling and do not select targets.
2. `capability_model.called_contracts` contains sorted, unique exact
   `{service, contract}` tuples. Every tuple must be consumed by the owner
   service and provided by that named service. Its only possible positive
   destination is the identical `contracts.call` tuple.
3. `transitive_effects` are derived from the called provider and the acyclic
   Service Dependency Graph closure. They are impact-analysis data only and
   can never populate an execution-authority collection.

`declared_side_effects` remains human-readable domain-outcome vocabulary. It is
not a permission source and is not the typed transitive projection.

## Projection and provenance

The closed repository projection is
`{$schema, schema_version: 1, source_snapshot, functions, digest}`. It binds the
complete Architecture Snapshot Identity v1 pair with
`architecture_contract_version: 2`.

Each sorted function record contains `function_key`, `owner_service`, exact
`manifest_path`, sorted `direct_capabilities`, sorted `called_contracts`, and
sorted `transitive_effects`. Each effect contains:

- `effect_kind`: `database_read`, `database_write`,
  `network_outbound_host`, `secret_reference`, `runtime_dependency`, or
  `approved_package`;
- the committed manifest `target`, `provider_service`, `source_path`, and JSON
  `source_pointer`; and
- every distinct sorted `provenance_path` of exact
  `{provider, consumer, contract}` edge identities from the root call to the
  effect owner.

The projection is conservative at service granularity. It can over-select an
effect for impact analysis; it cannot prove contract behavior, provider
availability, credential custody, or permission.

Effect identity is `[function_key, effect_kind, target, provider_service,
source_path, source_pointer]`. Duplicate provenance paths are removed by
canonical JSON identity. All collections use the repository UTF-16 comparator.
`digest` is lowercase SHA-256 of canonical-JSON UTF-8 bytes for the complete
projection after excluding only top-level `digest`, with no trailing newline.

The projection provider requires both the candidate `source_snapshot` and a
separately trusted expected snapshot. It strictly validates both complete
identity/digest pairs and requires byte-equivalent canonical content; neither
argument defaults to the other. The repository assertion then applies the
Architecture Snapshot Identity current-source assertion before rebuilding and
comparing the complete model. A self-consistent old commit is therefore stale.

## Fail-closed validation

Raw `capability_model` shape, version, tuple order, and duplication are checked
before strict Function Manifest schema loading. Typed validation then rejects
unsupported direct values, unknown or unconsumed contracts, graph cycles,
duplicate function identities, missing sources or provenance, stale snapshots, and direct/transitive
conflation. Diagnostics are records
`{function_key, field_path, code, target, provenance}` sorted in that field
order using canonical provenance.

Function keys are repository identities. Duplicate keys fail before projection
and fail again at projection-validation and selected-function boundaries.

The selected-function grant boundary requires one exact adopted function and
an independently supplied Execution Authority v1 declaration. It admits only:

- database reads or writes backed by the matching direct capability and owned
  by the selected function's service; and
- exact called-contract tuples declared by that function.

It rejects missing or multiple selection, a mismatched service, unmapped
database or contract authority, and every filesystem, network, secret, package,
or external positive. Normal Execution Authority validation still performs all
exact-target, ownership, compatibility, prohibition, and provenance checks.

## Provider examples and staged adoption

`momi.preorder.payment.initiate.v1` calls
`square-payment-delivery/square.payment.execute.v1`. Square hosts, secret names,
packages, and implementation remain effects of the provider and cannot become
caller authority.

`momi.communications.evaluate_item.v1` calls
`model-execution-gateway/momi.model_execution.execute.v1`. OpenAI hosts, secret
names, database state, dependencies, and implementation remain provider-only
effects.

Monitoring is deterministic provider output plus adopted/absent counts. A
breaking field, effect kind, provenance, order, or derivation change requires
Function Capability Model v2 and another architecture-contract version bump.
