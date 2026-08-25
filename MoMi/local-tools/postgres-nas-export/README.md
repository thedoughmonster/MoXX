# PostgreSQL 17 NAS Archives

## Purpose

This manual Windows-native tool creates a self-sufficient database archive on
a remote NAS. Each run preserves the resumable PostgreSQL custom dump used by
restore drills and adds portable source and canonical warehouse SQL exports.
An operator may also attach an untouched directory of manual Toast exports.
The tool is never hosted or scheduled.

## Prerequisites

- Node 24 and the repository's pinned pnpm version.
- PostgreSQL 17 Windows client tools installed locally.
- An existing writable remote UNC directory such as `\\nas01\backups\momi`.
- Standard libpq connection variables in the current PowerShell process.

Set `MOMI_PG17_BIN` to an absolute local directory containing `pg_dump.exe` and
`pg_restore.exe`. Both executables must report PostgreSQL major version 17.

For export and restore, set `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and
`PGPASSWORD`. Optional TLS settings are `PGSSLMODE`, `PGSSLROOTCERT`,
`PGSSLCERT`, `PGSSLKEY`, `PGCHANNELBINDING`, and `PGTARGETSESSIONATTRS`.
Passwords stay in the child-process environment; they never enter arguments,
logs, manifests, receipts, or checkpoints.

## Export

Every command is a dry run unless `--execute` is present. Execution requires
typing the displayed phrase exactly in an interactive terminal.

```powershell
pnpm local:db-export -- --env prod --project-ref viodfldzuoypnpqaagag `
  --target '\\nas01\backups\momi'
pnpm local:db-export -- --env prod --project-ref viodfldzuoypnpqaagag `
  --target '\\nas01\backups\momi' --execute
```

The pinned PostgreSQL 17 `pg_dump` creates three compressed logical artifacts:

- `database.pgdump`: custom format, gzip level 9, all configured schemas.
- `source.sql.gz`: plain SQL gzip containing all `toast_*` schemas plus
  `momi_archive`, including source coverage and manual-export evidence.
- `warehouse.sql.gz`: plain SQL gzip containing canonical `momi_warehouse` data.

All exports exclude ownership and grants. The custom dump is checked with
`pg_restore --list`; both portable exports are fully decompressed to verify
their gzip CRC and stream integrity.

## Manual Exports

Pass an absolute local directory outside the repository when the archive must
include operator-created Toast exports:

```powershell
pnpm local:db-export -- --env prod --project-ref viodfldzuoypnpqaagag `
  --target '\\nas01\backups\momi' `
  --manual-export-dir 'C:\Toast Exports\2026-11-final' --execute
```

Files retain their relative names under `manual/` and are copied byte-for-byte.
The source directory is read only and re-hashed after copying. Device paths,
repository paths, traversal, unsafe Windows names, symbolic links, junctions,
hard links, and non-regular entries are rejected. The local source path is not
stored. A resumed manual run must repeat `--manual-export-dir`; its bytes must
match the relative size/SHA-256 checkpoint.

Resume an interrupted run with its printed run identifier:

```powershell
pnpm local:db-export -- --env prod --project-ref viodfldzuoypnpqaagag `
  --target '\\nas01\backups\momi' `
  --resume 20260714T180000000Z-abcdef123456 --execute
```

## Publication And Verification

Artifacts are staged under the run identifier and atomically renamed into the
archive. A partially moved run accepts exactly one staged or published copy of
each expected path. `manifest.json` is atomically published last and records
the SHA-256 and byte size of all three database artifacts and every manual file.
Unexpected files or directories invalidate the archive.

Verification re-hashes every listed file, checks every byte size, rejects links
and changed or extra paths, verifies that the manifest is newest, decompresses
both portable exports, and repeats the custom dump TOC check.

```powershell
pnpm local:db-verify -- --env prod --project-ref viodfldzuoypnpqaagag `
  --target '\\nas01\backups\momi' `
  --archive 20260714T180000000Z-abcdef123456 --execute
```

## Quarterly Restore Drill

Create an empty PostgreSQL database named `momi_restore_drill_*`. Set `PGHOST`
to `localhost`, `127.0.0.1`, or `::1`, and set `PGDATABASE` to exactly the value
passed as `--isolated-target`. Remote and default databases are rejected.

```powershell
pnpm local:db-restore-drill -- --env prod --project-ref viodfldzuoypnpqaagag `
  --target '\\nas01\backups\momi' --archive 20260714T180000000Z-abcdef123456 `
  --isolated-target momi_restore_drill_2026_q3 --quarter 2026-Q3 --execute
```

The drill first verifies every archive file, then restores `database.pgdump` in
one transaction and writes a data-free passed receipt. New drills must name the
current UTC quarter; interrupted drills add `--resume <run-id>`.

## Retention

Retention keeps the newest archive for each of 30 days, each of 12 months, and
each calendar year indefinitely. An archive is verified immediately before it
is pruned. Incomplete archives without a manifest and unrecognized directories
are never pruned. One export, verification, or drill owns the NAS lock at a time.
