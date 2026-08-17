# Project Baseline Decision Ledger

## Purpose

This runbook covers the private append-only material-decision ledger owned by
`project-baseline-governance`. It does not authorize production promotion.

## Bootstrap entry shape

Each ordered JSON entry supplies `temporary_id`, `temporary_digest`, `category`,
`decision`, `rationale`, `alternatives`, `consequences`, `decided_by`,
`decided_at`, `source_snapshot`, optional `supersedes_temporary_id`, and
optional evidence and external-reference arrays. Superseded entries must
appear earlier in the array. Every source, event, evidence, and reference
preimage has exactly `schema_version: 1`, `encoding: "utf-8"`, and string
`content`. Its digest is SHA-256 of the exact UTF-8 `content` bytes, not the
JSON wrapper. PostgreSQL stores the wrapper, recomputes every expected digest,
canonicalizes each complete bootstrap entry, and then computes its temporary
digest and the ordered manifest digest. No caller-supplied digest is trusted.

The bootstrap ledger identity is fixed to
`project-baseline-pre-ledger-v1`; a singleton reconciliation row makes the
complete bootstrap globally one-shot. A changed key, entry, order, preimage,
or expected digest must fail.

## Development verification

### Pre-publication local check

Apply the migration to disposable PostgreSQL 17 with the three Supabase API
roles and `pgcrypto` in `extensions`. Run the psql receipt and the opt-in
two-connection concurrency test. Both must pass; the SQL ends in `ROLLBACK`.
The concurrency result is the accepted pre-release serialization proof because
the credential-free hosted connector exposes one SQL session, while the same
migration body runs in both databases. This is not the hosted receipt.

### Persistent development receipt

1. Verify exact commit, tree, and migration parity in the development release
   receipt; confirm the schema is absent from the Data API schema setting.
2. Through the exact-dev Supabase SQL connector, submit
   `tests/project_baseline_decision_ledger_connector.pg.sql` unchanged. Its
   SHA-256 is `b1d005668e09b3c1ddbfcf36821b45cdd5b0c77daa0564e2b9bdebc5dd079d0d`.
3. Preserve its successful `BEGIN`/`ROLLBACK` output as the real development transaction receipt. Static repository tests do not prove runtime behavior.
4. Confirm forced RLS, no policies or API grants, and trusted-operator-only
   routine execution from that receipt before any persistent ledger row.
5. Bind release SHA/tree, project ref, migration SHA, connector-receipt SHA,
   bootstrap-fixture SHA, readback SHA, and manifest digest in the operator receipt.
6. Submit `tests/project_baseline_bootstrap_apply_fixture.pg.sql` unchanged to
   exact development only. It is private-routine DML, never DDL, deployment,
   credential handoff, improvised SQL, or production authority.
7. Submit `tests/project_baseline_bootstrap_readback.pg.sql` unchanged; its
   SHA-256 is `c1dc9da1227c85deefb9a0df5f10c8042feb9737cb11c659cf138e08822037f0`.
   Require `valid: true` and preserve reconciliation ID, mapping, digests, and time.
8. Repeat the bootstrap fixture and readback unchanged; require identical
   mapping and counts with no new events.
9. Append the first native decision through the same exact-project DML boundary
   and preserve its permanent UUID and digest.

## Failure handling

Stop on migration drift, unexpected grants, digest mismatch, partial mapping,
or a non-idempotent replay. Do not edit rows or rerun with changed content.
Append a corrective decision only after the failure is understood.

## Rollback

Disable callers and revoke access. Preserve every ledger table. Never drop,
truncate, or rewrite decision history as a rollback action.
