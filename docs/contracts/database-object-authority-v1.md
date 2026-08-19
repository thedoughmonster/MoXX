# Database Object Authority v1

## Status and boundary

`database-object-authority/v1` is a generated, revision-bound view of five
separate layers: exact owned objects, runtime compatibility, migration-file
ownership, public mappings, and the canonical legacy-debt reference. Generate
it on demand from Git objects. Do not commit a revision-bearing instance.

Only an Execution Authority v2 capability is positive worker authority.
Manifest `database.read` and `database.write` strings are compatibility
evidence; migration headers and public mappings are non-grant evidence; legacy
debt can only subtract authority or cause a diagnostic. Runtime grants are an
external observation and are not generated here.

## Identity and modes

Relations use `{class, schema, name}` and normalize tables, views, and
materialized views to class `relation`. Routines add the replay-canonical input
`arguments` array, so every overload is distinct. Sequence identity is
reserved for future use; the current replay produces no sequence objects.
Identifiers are lowercase unquoted identifiers. There is no schema class.

Positive modes are `relation.read`, `relation.write`, `routine.call`, and the
future-only `sequence.use`. `migration.own`, `public.read.map`, and
`public.command.map` describe evidence, not grants. Read and write on the same
relation are two independent legal capabilities.

## Generated records and digests

`objects` resolves validated `owned_dataset` declarations through migration
replay and requires one owner. `runtime_compatibility` preserves the source
mode and either an exact replay-resolved object or class-neutral
`historical_broad_migration_debt`. `migration_ownership` contains only exact
path/blob/header-owner records. `public_mappings` preserves its mapping kind;
dynamic read mappings also preserve consumer, role, allowed schema, contract,
and routine constraints. `legacy_debt_reference` contains only path, version,
and digest.

`source_digest` is SHA-256 of canonical JSON for the UTF-16-sorted source
descriptor set. A descriptor contains classification, repository path, Git
blob identity, and applicable schema version. Generated output and prose are
excluded. `authority_digest` is SHA-256 of canonical JSON for the completed
value with only `$schema` and `authority_digest` omitted; `source_digest`
remains included. The graph is therefore acyclic.

## Broad-declaration ratchet

For each revision, derive broad tuples `[service, source_mode, schema]` from
bare supported schema identifiers and exact tuples `[service, source_mode,
canonical_object_identity]` from qualified entries resolved by replay. Compare
only the trusted base and candidate.

For each new candidate broad tuple, emit exactly one code in this precedence:
`broad_declaration_worsened` for added write breadth over base broad read,
`broad_declaration_widened` when it replaces base exact compatibility in that
mode/schema, otherwise `broad_declaration_added`. Unchanged tuples, unrelated
manifest touches, and removals pass. A zero base needs no registry: recurrence
is an addition. An unavailable trusted base emits
`ratchet_baseline_unavailable` and makes only the requiring admission
operation indeterminate.

## Diagnostics and downstream use

The normative diagnostic tuple is `[subject, layer, source_path, json_pointer,
code, object_class, canonical_identity, mode]`; absent members are empty
strings. Tuples sort by UTF-16 comparison of canonical JSON. Unknown or
ambiguous objects/classes, mode conflicts, duplicate/conflicting authority,
owner ambiguity, invalid cross-owner targets/mappings, debt-derived authority,
new broad declarations, and digest drift fail closed.

MOX-128 may consume only a successfully validated value pinned by repository,
revision, source digest, and authority digest. It may join class-neutral broad
compatibility to exact relations for reporting, but may never expand broad
compatibility into routine/sequence identity or positive authority.
