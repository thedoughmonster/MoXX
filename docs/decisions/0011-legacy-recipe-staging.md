# 0011: Legacy Recipe Staging

- Status: accepted
- Date: 2026-07-16

## Context

The local legacy SQLite warehouse contains Dough Monster-authored recipe facts,
versions, mappings, and provenance that cannot be reacquired from a POS. Those
facts need a lossless preservation landing area before semantic repairs or a
canonical recipe model are designed.

Importing directly into canonical warehouse tables would mix preservation with
business decisions. In particular, the legacy data has ambiguous current-version
selection, incomplete unit conversions, partial costs, and unresolved ingredient
links. An overnight import must not silently choose among those records.

## Decision

The `warehouse-projection` capability owns a private
`legacy_recipe_staging` schema. A manual Windows-native tool authenticates the
package against a pinned detached checksum-ledger digest, enforces the exact
approved dataset list, and writes complete JSON source rows into development
only through the repository-pinned linked Supabase CLI. Exact, TLS-verified
PostgreSQL credentials remain an explicit fallback.

The schema records import runs, source files, source-table descriptors, immutable
source rows, separate repair findings, and reconciliation evidence. Source
identity is represented by package, database, table, and source-row keys rather
than Toast identifiers or assumed legacy columns. Stable uniqueness and content
hashes make retries idempotent; run checkpoints make interrupted batches
resumable.

The schema is outside the Data API, grants no access to `public`, `anon`,
`authenticated`, or `service_role`, and enables RLS without public policies.
Immutable evidence tables reject update, delete, and truncate. Run and batch
provenance is frozen while operational status and checkpoint fields can advance.
No function uses `SECURITY DEFINER`.

The local importer defaults to dry-run, rejects production, requires the exact
development project reference and interactive confirmation for writes, and
rechecks linked project identity and each ordered SQL file before execution.
Verification hashes stored canonical payload text in PostgreSQL rather than
trusting imported hash columns, compares it with JSONB, and records each result.

## Promotion Prohibition

Staging is preservation evidence, not a canonical recipe API. Nothing in this
decision selects a current recipe, repairs units, computes costs, publishes
warehouse entities, exposes a read contract, or deletes legacy data. Promotion
requires a later accepted ADR, explicit mapping rules, and independently tested
reconciliation.

## Consequences

- Every legacy field and version can be retained before interpretation.
- Repair queues remain visibly separate from source facts.
- An interrupted import can be rerun without duplicate records.
- Business consumers cannot read staging through the Data API or MoMi API.
- The preservation package remains the exact-byte archive; JSONB staging is its
  queryable, hash-reconciled representation.
