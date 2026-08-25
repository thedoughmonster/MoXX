# Legacy Access Governance Report v1

`docs/legacy-access-governance-report.json` is disposable, generated debt
evidence. It derives only from `docs/service-access-debt-baseline.json`. It is
not desired state, positive authority, permission, a grant, an access-removal
instruction, a compiled-architecture input, or an execution-packet input.

## Identity and provenance

The artifact validates against
`schemas/legacy-access-governance-report-v1.schema.json`. Its exact identity
fields are `legacy-access-governance-report/v1`,
`legacy_access_governance_report`, and `legacy_debt_evidence_only`.

`source` records the repository, canonical baseline path, Git blob OID, baseline
schema ID and version, preserved `generated_from` marker, complete UTF-8 byte
SHA-256, finding count, and counts for all four supported rules. It deliberately
does not name the commit or tree containing the report.

The existing baseline `fingerprint`, qualified by `source`, is the only row
identity. All source fingerprints appear exactly once. Duplicate, changed,
untrusted, unsorted, or unsupported identities abort generation.

## Closed findings union

- `direct_private_relation_access` copies subject, consumer, owner, relation,
  read/write access, decimal reference count, and SQL source hash.
- `direct_private_routine_call` copies the same available evidence for a
  routine. `call` is entailed by the rule and is marked with
  `direct_private_routine_call/v1` as its basis.
- `dynamic_event_name` and `dynamic_relation_identifier` copy subject,
  service key, expressions, and service source hash. Their access projection is
  `unavailable_from_source`; consumer, owner, object, access, reference count,
  and SQL hash are forbidden.

Every variant is strict. Summary prose is excluded because it is not finding
identity. Known dynamic rows are evidence, not inferred database access.

## Canonicalization and digests

Rows sort by fingerprint with the repository UTF-16 comparator. Canonical JSON
recursively sorts object keys and preserves array order.

`findings_sha256` hashes canonical JSON for the complete sorted `findings`
array. `report_digest` hashes canonical JSON for the full report after removing
only `$schema` and `report_digest`. Both are lowercase SHA-256 without a prefix.
No time, locale, filesystem order, commit, tree, or narrative value participates.

Generation validates the complete source, builds and validates in memory,
reconciles counts, fingerprint sets, and digests, then atomically replaces the
artifact. Check mode recomputes all identities and rejects missing, stale, or
noncanonical output.

## Fail-closed diagnostics

Stable failure classes are:

- `legacy_report_source_json_invalid`
- `legacy_report_source_version_unsupported`
- `legacy_report_finding_kind_unsupported`
- `legacy_report_finding_identity_invalid`
- `legacy_report_fingerprint_duplicate`
- `legacy_report_known_variant_incomplete`
- `legacy_report_access_mode_unsupported`
- `legacy_report_provenance_incomplete`
- `legacy_report_count_mismatch`
- `legacy_report_fingerprint_set_mismatch`
- `legacy_report_digest_mismatch`
- `legacy_report_artifact_stale`

Failures produce diagnostics, never partial report rows.

## Authority exclusion and lifecycle

The strict schema has no grant, allowed, permission, desired, effective,
preserve, revoke, action, positive-authority, or executable-authority
collection. Service Authority Binding v1 continues to accept only exact
baseline identity references. Execution Authority v1 rejects report-reference
fields and continues to reject debt-derived positive database authority.

Current architecture and authority validation must produce identical results
whether report evidence is present or absent, except for this dedicated checker.
Current authority modules must not import or reference the report. Future
compiler and execution-packet consumers are normatively required to reject it;
those absent APIs are not invented here.

When an accepted repair removes a baseline finding, regeneration removes its
report row. V1 has no tombstone or supersession inference. The report neither
preserves access nor authorizes its removal.

Run `pnpm legacy-access-report:generate` to regenerate and
`pnpm legacy-access-report:check` to verify.
