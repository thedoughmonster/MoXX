# Project Baseline bootstrap manifest

## Status and boundary

This manifest contains six material decisions accepted before the permanent ledger
was available. State is `accepted`; enforcement remains `pending` where incomplete.

The durable instruction has date precision only. Canonical `decided_at` is
`2026-08-17T00:00:00.000000Z`; `source_snapshot` records that limitation.

## Digest byte contract

Every digest is lowercase SHA-256 of the exact UTF-8 code-block bytes, with no
BOM or trailing newline; each interior newline is byte `0a`. Verify by hashing
only the code-block content as UTF-8 without a final newline.

### PB-BOOT-001

Digest:
`1f2b1a67f89cb37829a0455c8711d29ffa2f2eca5903f4f0ab133d2eba6c3680`

```text
Bring Mission: Project Baseline to the Remediation Ready gate: establish the Linear project and portfolio freeze, build and use the Supabase decision ledger, exhaustively audit the Mo-XX codebase, stack, runtime, integrations, databases, GitHub, and project boards, independently validate and deduplicate findings, and produce decision-complete remediation issues in Linear.
```

### PB-BOOT-002

Digest:
`e2fd5ed0712f57e8eb5674c857b9b07c944e63b616123772733b32a9780244aa`

```text
pause existing Linear projects while preserving exact restoration manifest.
```

### PB-BOOT-003

Digest:
`000e7fadb4ffb2857fbfa0e08c7f0a2c9a33a51ad75912914efe41544b1e4143`

```text
apply mission:project-baseline to all existing issues and blocked:project-baseline plus native blockedBy relation to every unfinished non-baseline issue;
Terminal history gets only scope label, not false blocker relation.
```

### PB-BOOT-004

Digest:
`55a94b37d94d9e18ad8662e3efd3b55f602e6ab9a52f02ea9d7b607a1ce40faf`

```text
Canonical authority: Linear owns executable scope/status/dependencies/acceptance. Supabase owns immutable material decision history.
```

### PB-BOOT-005

Digest:
`e4ace33ce4ffd69b97bdf352648ab83eacb6250de820628a4cf1549b1dae9906`

```text
You are the fresh unforked overnight coordinator for Mission: Project Baseline.
Continuity: create a durable Linear Coordinator Checkpoint and update after every worker wave with queue/completed/active work, accepted/disputed findings, decision IDs, constraints, and exact next actions. Consume summaries, not raw transcripts.
```

The title is a coordinator-approved restatement of these owner bytes. The digest
does not claim a verbatim owner title or ledger an agent-selected worker-count cap.

### PB-BOOT-006

Digest:
`9d8f5ecf69f4af471d1facaabc7e067f760d67233653218aca743aed554d127b`

```text
All surfaces are read-only except allowlisted Linear governance and decision-ledger implementation/use. Do not alter production or begin non-ledger remediation.
```

## Linear reference bytes

Reference digests use the same UTF-8, no-BOM, no-trailing-newline rule.

| Locator bytes | SHA-256 |
| --- | --- |
| `linear:project:Project Baseline` | `6b170fd87ee583c8d7e732524129235d3a630cf77fe783af91440740d5395051` |
| `linear:initiative:Mo-XX Product and Platform Delivery` | `37279859c71c9e0c5dd0651f2a69b28950c88d773d6fb0bdc226fff215cdb960` |
| `linear:issue:MOX-167` | `8da75c17faafab106aa89f172d3832d172a04229efdb1f16976eb15cc84839e0` |
| `linear:issue:MOX-168` | `1a81950587cbc5df3dff44523a143356034b87ecbfc4180795b1e4af28e29958` |
| `linear:issue:MOX-176` | `722e5040eaf733cab5a4514de7f99be434a88f673699a444fd6b1c2a0f764ae5` |

A verifier resolves each public locator in Linear, confirms its human-readable
identity, and separately recomputes the locator digest from the literal bytes
above. The digest binds the stable public locator, not an exported issue body,
internal UUID, raw status ID, or private payload.

## Governed development apply path

1. Publish the schema and fixed fixtures from canonical `dev` through the
   governed pull-request and exact-receipt development release only.
2. Submit the exact-dev connector rollback payload
   `tests/project_baseline_decision_ledger_connector.pg.sql` (SHA-256
   `b1d005668e09b3c1ddbfcf36821b45cdd5b0c77daa0564e2b9bdebc5dd079d0d`).
3. Preserve its successful hosted `ROLLBACK` before persistent rows. Bind the
   release SHA/tree, project ref, migration and fixture hashes, and manifest digest.
4. Submit `tests/project_baseline_bootstrap_apply_fixture.pg.sql` unchanged
   through the same connector as private-routine DML, never DDL or production.
5. Submit `tests/project_baseline_bootstrap_readback.pg.sql` unchanged
   (SHA-256 `c1dc9da1227c85deefb9a0df5f10c8042feb9737cb11c659cf138e08822037f0`);
   require `valid: true` and preserve its mapping and reconciliation metadata.
6. Repeat both bootstrap and readback unchanged; require the identical mapping,
   six decisions, twelve events, one reconciliation, and no new events.
7. Keep the psql manifest receipt rollback-only. Never improvise a query or
   append findings before reconciliation completes.

## Exclusions

The bootstrap omits ledger schema implementation choices, agent-inferred audit
findings, severities, dispositions, remediation ownership, and routine
coordination mechanics. Those require native proposals after the permanent
ledger is operational.
