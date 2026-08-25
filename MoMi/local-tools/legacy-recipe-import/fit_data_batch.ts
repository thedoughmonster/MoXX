import { buildFindingBatchSql } from "./build_finding_batch_sql.ts"
import { buildSourceBatchSql } from "./build_source_batch_sql.ts"
import { MAX_BATCH_ROWS, MAX_SQL_FILE_BYTES } from "./constants.ts"
import type {
  LoadedExport, LoadedPackage, RepairFinding, SourceRow,
} from "./types.ts"

export function fitDataBatch(
  pkg: LoadedPackage,
  item: LoadedExport,
  allRows: Array<SourceRow | RepairFinding>,
  offset: number,
  batchOrdinal: number,
): { rows: Array<SourceRow | RepairFinding>; sql: string } {
  let low = 1
  let high = Math.min(MAX_BATCH_ROWS, allRows.length - offset)
  let accepted: { rows: Array<SourceRow | RepairFinding>; sql: string } | undefined
  while (low <= high) {
    const size = Math.floor((low + high) / 2)
    const rows = allRows.slice(offset, offset + size)
    const sql = item.manifest.kind === "source_table" ?
      buildSourceBatchSql(pkg, item, rows as SourceRow[], batchOrdinal) :
      buildFindingBatchSql(pkg, item, rows as RepairFinding[], batchOrdinal)
    if (Buffer.byteLength(sql, "utf8") <= MAX_SQL_FILE_BYTES) {
      accepted = { rows, sql }
      low = size + 1
    } else {
      high = size - 1
    }
  }
  if (!accepted) throw new Error(`One sealed row exceeds SQL ceiling: ${item.manifest.file}`)
  return accepted
}
