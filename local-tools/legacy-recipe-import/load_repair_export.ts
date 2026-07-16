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
import { validateFindings } from "./validate_findings.ts"

export async function loadRepairExport(
  portableRoot: string,
  portable: PortableManifest,
  ledger: ChecksumLedger,
  importRunId: string,
): Promise<LoadedExport> {
  const repair = portable.repair_findings
  const file = portableRelativePath(repair.relative_path)
  const packagePath = `portable/${file}`
  const ledgerHash = requireLedgerHash(ledger, packagePath)
  if (ledgerHash !== repair.sha256) throw new Error(`Ledger mismatch: ${file}`)
  const absolutePath = await resolveExportPath(portableRoot, file)
  const bytes = await readSealedBytes(absolutePath, ledgerHash, repair.bytes)
  const pending: ManifestExport = {
    kind: "repair_findings", file, format: repair.format, bytes: repair.bytes,
    sha256: repair.sha256, row_count: repair.finding_count, rows_sha256: "",
    metadata: repair,
  }
  const rawFindings = await loadExportRows(bytes, pending)
  if (rawFindings.length !== repair.finding_count) {
    throw new Error(`Row count mismatch: ${file}`)
  }
  const findings = validateFindings(rawFindings, file)
  const fingerprints: FingerprintRow[] = findings.map((row) => ({
    ordinal: row.ordinal, key: row.finding_key, sha256: row.finding_sha256,
  }))
  return {
    manifest: { ...pending, rows_sha256: fingerprintRows(fingerprints) },
    absolutePath, sourceFileId: stableUuid(`file:${importRunId}:${file}`), findings,
  }
}
