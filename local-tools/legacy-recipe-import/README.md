# Legacy Recipe Import

## ELI5

This tool opens a sealed box of old recipe records, checks every label and
fingerprint, and prepares small repeatable SQL batches for MoMi development. It
does not decide which recipe is current, fix units, calculate costs, publish a
recipe, or touch production.

## Input

`--source` is an absolute preservation-package directory. The importer first
matches `SHA256SUMS.txt` to the pinned audited digest, checks its adjacent
sidecar, then authenticates both source SQLite backups and every approved
portable file from that trusted ledger. No SQLite driver or WSL access is used.

Only the 15 registered recipe datasets, their exact paths, and their
`../databases/toast.sqlite` source identity are accepted. Extras, omissions,
duplicates, links, junctions, reparse points, and changed bytes are rejected.

Manifest format version 1 records:

- The verified source SQLite hash and integrity results as provenance.
- Each source table, primary-key ordering, complete schema/column metadata,
  JSON path, byte count, reread row count, and SHA-256.
- One repair-findings JSON object with its count, byte count, SHA-256, and
  successful source-side reconciliation.

Every table JSON value is imported unchanged as one `jsonb` row and as its
canonical UTF-8 payload text. The importer
derives its stable source key from the manifest's ordered primary-key columns,
then hashes canonical row JSON. Each complete repair finding is handled the same
way using its `finding_id`. Canonical JSON recursively sorts object keys. An
aggregate hash covers ordered UTF-8 lines in this form:

```text
ordinal<TAB>source-key<TAB>row-sha256<LF>
```

The SQLite backup remains the exact-byte authority. Staging is its queryable,
content-reconciled representation.

## Output

After all local file hashes and counts pass, the command writes byte-stable SQL
files and `plan.json` outside every Git worktree under
`%TEMP%\MoMi\checkpoints\legacy-recipe-import\<import-run-id>`. The plan
records every SQL file's byte count and SHA-256. Import files contain sensitive
source JSON and must remain in that private local checkpoint directory.

Every SQL file is at most 512 KiB. Files marked `import` and
`verification-query` are executed sequentially by the pinned linked-development
Supabase CLI, with project binding and file hashes checked again before each
call. Sealed import and verification failure markers use that identical path.
Final reconciliation commits before its small status result is interpreted, so
a reported failure remains durable. SQL output stays limited to status values.

The database receives private import runs, file/table provenance, immutable
complete JSON rows, separate repair findings, batch checkpoints, and recorded
reconciliation results.

## Safety

Every invocation defaults to dry-run and rejects production. Database writes
require exactly `--env dev --project-ref xtbraqnlskmqxinjxxdn --execute`, an
absolute source path, and the interactive phrase printed by the command.
The default `supabase-cli` backend uses the repository-pinned CLI and its local
account credential; it does not need a PostgreSQL password. Secrets and source
rows are never printed or placed in `plan.json`.

```powershell
pnpm local:legacy-recipe-import -- --env dev `
  --project-ref xtbraqnlskmqxinjxxdn `
  --source 'C:\absolute\preservation-package'
```

Add `--execute` only after reviewing the emitted plan. The tool links exactly
`xtbraqnlskmqxinjxxdn`, verifies both the workspace and linked project before
every file, and stops on the first failed statement. Batches contain at most 250
rows and shrink deterministically to remain under 512 KiB.

The optional `--backend psql` fallback requires `PGHOST`, `PGPORT=5432`,
`PGDATABASE=postgres`, the exact direct or session-pooler dev user/host pair,
`PGPASSWORD`, and `PGSSLMODE=verify-full`. Other hosts and TLS modes fail closed.

## Resume

Run, file, table, row, finding, and batch identifiers derive from package hashes
and source identities. Every batch uses conflict-safe inserts, rejects different
content behind an existing identity, and marks its checkpoint in the same
transaction. Rerun the identical command to resume; completed batches are safe
to replay.

## Verification

Import mode verifies automatically after all batches finish. A later independent
check uses `--mode verify --execute` with the same target and source. It locally
revalidates the package, recomputes every SHA-256 from stored canonical payload
text with `extensions.digest`, compares JSONB equality, counts, and aggregate
fingerprints, records every result, and fails on any difference.

No cleanup or canonical promotion command exists.

The real PostgreSQL harness is `pnpm test:legacy-recipe-postgres`. It requires
the disposable WSL socket described by the test environment variables, creates
and drops only a temporary database, and never contacts Supabase.
