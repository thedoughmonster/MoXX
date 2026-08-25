import { buildCompleteSql } from "./build_complete_sql.ts"
import { buildFailureMarkerSql } from "./build_failure_marker_sql.ts"
import { buildMetadataSql } from "./build_metadata_sql.ts"
import { buildRemoteQuery } from "./build_remote_query.ts"
import { buildRunSql } from "./build_run_sql.ts"
import { buildVerifyCompleteSql } from "./build_verify_complete_sql.ts"
import { MAX_SQL_FILE_BYTES } from "./constants.ts"
import { fingerprintRows } from "./fingerprint_rows.ts"
import { fitDataBatch } from "./fit_data_batch.ts"
import { sha256Text } from "./sha256_text.ts"
import type {
  FingerprintRow, LoadedPackage, PlannedSqlFile, RepairFinding, SourceRow,
} from "./types.ts"

export function buildPlanFiles(pkg: LoadedPackage): PlannedSqlFile[] {
  const batches: PlannedSqlFile[] = []
  let fileOrdinal = 1000
  for (const item of pkg.exports) {
    const allRows = (item.sourceRows ?? item.findings ?? []) as Array<
      SourceRow | RepairFinding
    >
    let offset = 0
    let batchOrdinal = 1
    while (offset < allRows.length) {
      const fitted = fitDataBatch(pkg, item, allRows, offset, batchOrdinal)
      const fingerprintInput: FingerprintRow[] = fitted.rows.map((row) =>
        "source_key" in row ? {
          ordinal: row.ordinal, key: row.source_key, sha256: row.row_sha256,
        } : {
          ordinal: row.ordinal, key: row.finding_key, sha256: row.finding_sha256,
        }
      )
      const batchKey = `${item.manifest.file}#${String(batchOrdinal).padStart(6, "0")}`
      batches.push({
        file: `${String(fileOrdinal).padStart(6, "0")}_batch.sql`, phase: "import",
        sql: fitted.sql, bytes: Buffer.byteLength(fitted.sql, "utf8"),
        sha256: sha256Text(fitted.sql), batch_key: batchKey,
        expected_row_count: fitted.rows.length,
        payload_sha256: fingerprintRows(fingerprintInput),
      })
      offset += fitted.rows.length
      batchOrdinal += 1
      fileOrdinal += 1
    }
  }
  const raw = [
    ["000000_import_run.sql", "import", buildRunSql(pkg, batches.length)],
    ["000001_source_metadata.sql", "import", buildMetadataSql(pkg)],
    ...batches.map((file) => [file.file, file.phase, file.sql]),
    ["900000_complete.sql", "import", buildCompleteSql(pkg.importRunId)],
    ...pkg.exports.map((item, index) => [
      `${String(910000 + index).padStart(6, "0")}_verify.sql`,
      "verification-query", buildRemoteQuery(pkg, item),
    ]),
    ["920000_verify_complete.sql", "verification-query", buildVerifyCompleteSql(pkg)],
    ["990000_import_failure.sql", "import-failure",
      buildFailureMarkerSql(pkg.importRunId, "import")],
    ["990001_verification_failure.sql", "verification-failure",
      buildFailureMarkerSql(pkg.importRunId, "verification")],
  ] as Array<[string, PlannedSqlFile["phase"], string]>
  const batchMap = new Map(batches.map((file) => [file.file, file]))
  return raw.map(([file, phase, sql]) => {
    const bytes = Buffer.byteLength(sql, "utf8")
    if (bytes > MAX_SQL_FILE_BYTES) throw new Error(`SQL file exceeds 512 KiB: ${file}`)
    return { file, phase, sql, bytes, sha256: sha256Text(sql), ...batchMap.get(file) }
  })
}
