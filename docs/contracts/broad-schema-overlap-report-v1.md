# Broad Schema Overlap Report v1

## Boundary

`broad-schema-overlap-report/v1` is an on-demand, revision-bound diagnostic
projection. It consumes only a clean, validated `database-object-authority/v1`
and the canonical debt-baseline bytes referenced by that value. It is not
committed as a live report.

The report is not desired state, positive authority, a grant, a permission, an
access-removal instruction, a compiler input, or an execution-packet input.
Manifest database entries remain source compatibility evidence. Upstream
database-authority validation and the candidate broad-declaration ratchet own
unknown objects, ambiguous owners, and new, widened, or worsened declarations.
Fatal upstream or baseline diagnostics produce no report.

## Relation-only projection

For every `runtime_compatibility` entry with
`historical_broad_migration_debt` scope, the generator selects exact owned
objects of class `relation` in the same schema. Exact compatibility entries,
routines, sequences, and catalog-only external relations are excluded.

Each discoverable relation creates one row. A broad declaration with no owned
relation creates one `undiscoverable` sentinel whose exact relation, owner,
relation kind, and object source are null. The sentinel means only that no
relation is discoverable from the validated authority surface; it does not
claim the physical schema is empty.

Classifications use this closed precedence:

1. `undiscoverable` for a sentinel;
2. `same-owner` when relation owner equals declaring service;
3. `known-direct-debt` for an exact cross-owner canonical debt match;
4. `cross-owner` for every other cross-owner row.

Debt matches canonical JSON of `[consumer_service, "database." + access,
relation, owner_service]`. Read and write match exactly. All matching
fingerprints are retained in unique UTF-16 order. Routine and dynamic debt
findings cannot match a row.

## Identity, provenance, and digests

Row identity is canonical JSON of `[declaring_service, compatibility_mode,
broad_schema, canonicalJson(exact_relation), owner_service]`. For a sentinel,
the fourth member is the string `"null"` and the fifth is null. Rows sort by
the repository UTF-16 comparator. Declaration and object source fields are
copied exactly from the validated authority value.

`input_digest` is SHA-256 over canonical JSON of `inputs`. `report_digest` is
SHA-256 over canonical JSON of the complete report after removing only
`$schema` and `report_digest`. Time, locale, filesystem order, and messages do
not participate.

At accepted revision `ff54beed51df9c75e25ec7eb8b5484fcb35e0769`, the
reviewed projection is 83 broad declarations and 635 rows: 300 same-owner, 283
cross-owner, 45 known-direct-debt, and 7 undiscoverable.

## Validation and lifecycle

The strict schema has no capability, command, grant, remediation, or action
field. Validation checks schema, row identity and semantic invariants,
canonical order, classification counts, and both digests. Report-specific
diagnostics are deterministic `{field_path, code, target}` tuples.

Run `pnpm broad-schema-overlap:generate` for canonical JSON on stdout and
`pnpm broad-schema-overlap:check` for in-memory current validation. Optional
arguments are candidate revision followed by trusted base revision. Generation
writes no repository or runtime source.

A new major report version is required for changes to authority input version,
row identity, classification precedence, debt join, source-mode mapping,
sentinel policy, ordering, or digest exclusions. Ordinary source changes and
accepted debt removals remain v1 with new digests and rows.
