import { fingerprintRows } from "./fingerprint_rows.ts"
import { loadExportRows } from "./load_export_rows.ts"
import { portableRelativePath } from "./portable_relative_path.ts"
import { readSealedBytes } from "./read_sealed_bytes.ts"
import { requireLedgerHash } from "./require_ledger_hash.ts"
import { resolveExportPath } from "./resolve_export_path.ts"
import { stableUuid } from "./stable_uuid.ts"
import type { PortableManifest } from "./manifest_types.ts"
import type {
  ChecksumLedger, FingerprintRow, LoadedExport, ManifestExport,
} from "./types.ts"
import { validateSourceRows } from "./validate_source_rows.ts"

export async function loadSourceExports(
  portableRoot: string,
  portable: PortableManifest,
  ledger: ChecksumLedger,
  importRunId: string,
): Promise<LoadedExport[]> {
  const exports: LoadedExport[] = []
  for (const table of portable.tables) {
    const file = portableRelativePath(table.relative_path)
    const packagePath = `portable/${file}`
    const ledgerHash = requireLedgerHash(ledger, packagePath)
    if (ledgerHash !== table.sha256) throw new Error(`Ledger mismatch: ${file}`)
    const absolutePath = await resolveExportPath(portableRoot, file)
    const bytes = await readSealedBytes(absolutePath, ledgerHash, table.bytes)
    const pending: ManifestExport = {
      kind: "source_table", file, format: table.format, bytes: table.bytes,
      sha256: table.sha256, row_count: table.sqlite_row_count, rows_sha256: "",
      source: { database: portable.source_database.relative_path, table: table.table },
      metadata: table,
    }
    const rawRows = await loadExportRows(bytes, pending)
    if (rawRows.length !== pending.row_count) throw new Error(`Row count mismatch: ${file}`)
    const sourceRows = validateSourceRows(rawRows, file, table.order_by)
    const fingerprints: FingerprintRow[] = sourceRows.map((row) => ({
      ordinal: row.ordinal, key: row.source_key, sha256: row.row_sha256,
    }))
    const sourceFileId = stableUuid(`file:${importRunId}:${file}`)
    exports.push({
      manifest: { ...pending, rows_sha256: fingerprintRows(fingerprints) },
      absolutePath, sourceFileId,
      sourceTableId: stableUuid(
        `table:${importRunId}:${pending.source?.database}:${table.table}`,
      ),
      sourceRows,
    })
  }
  return exports
}
