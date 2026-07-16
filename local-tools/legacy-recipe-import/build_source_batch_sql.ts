import { fingerprintRows } from "./fingerprint_rows.ts"
import { sqlLiteral } from "./sql_literal.ts"
import { stableUuid } from "./stable_uuid.ts"
import type { FingerprintRow, LoadedExport, LoadedPackage, SourceRow } from "./types.ts"

export function buildSourceBatchSql(
  pkg: LoadedPackage,
  item: LoadedExport,
  rows: SourceRow[],
  batchOrdinal: number,
): string {
  const entry = item.manifest
  const batchKey = `${entry.file}#${String(batchOrdinal).padStart(6, "0")}`
  const batchId = stableUuid(`batch:${pkg.importRunId}:${batchKey}`)
  const payload = fingerprintRows(rows.map((row): FingerprintRow => ({
    ordinal: row.ordinal, key: row.source_key, sha256: row.row_sha256,
  })))
  const values = rows.map((row) => [
    `${sqlLiteral(stableUuid(`row:${item.sourceTableId}:${row.source_key}`))}::uuid`,
    `${sqlLiteral(pkg.importRunId)}::uuid`, `${sqlLiteral(item.sourceTableId ?? "")}::uuid`,
    sqlLiteral(row.source_key), String(row.ordinal), sqlLiteral(row.row_sha256),
    sqlLiteral(row.payload_text),
  ].join(", ")).map((value) => `  (${value})`).join(",\n")
  return [
    `-- legacy-recipe-import batch: ${batchKey}`,
    "begin;",
    "insert into legacy_recipe_staging.import_batches (",
    "  import_batch_id, import_run_id, batch_key, source_file_id, batch_ordinal,",
    "  first_source_ordinal, last_source_ordinal, expected_row_count, payload_sha256",
    `) values (${sqlLiteral(batchId)}::uuid, ${sqlLiteral(pkg.importRunId)}::uuid,`,
    `  ${sqlLiteral(batchKey)}, ${sqlLiteral(item.sourceFileId)}::uuid, ${batchOrdinal},`,
    `  ${rows[0].ordinal}, ${rows.at(-1)?.ordinal}, ${rows.length}, ${sqlLiteral(payload)})`,
    "on conflict do nothing;",
    "select 1 / case when exists (select 1 from legacy_recipe_staging.import_batches",
    `  where import_batch_id = ${sqlLiteral(batchId)}::uuid`,
    `    and import_run_id = ${sqlLiteral(pkg.importRunId)}::uuid`,
    `    and batch_key = ${sqlLiteral(batchKey)} and expected_row_count = ${rows.length}`,
    `    and payload_sha256 = ${sqlLiteral(payload)}) then 1 else 0 end;`,
    "with incoming (source_row_id, import_run_id, source_table_id, source_row_key,",
    "  source_ordinal, row_sha256, row_payload) as (values",
    values,
    "), written as (",
    "  insert into legacy_recipe_staging.source_rows (",
    "    source_row_id, import_run_id, source_table_id, source_row_key,",
    "    source_ordinal, row_sha256, row_payload, row_document",
    "  ) select i.*, i.row_payload::jsonb from incoming i",
    "  on conflict do nothing returning source_row_id",
    ") select 1 / case when not exists (",
    "  select 1 from incoming i join legacy_recipe_staging.source_rows e",
    "    on e.source_table_id = i.source_table_id and (",
    "      e.source_row_id = i.source_row_id or e.source_row_key = i.source_row_key",
    "      or e.source_ordinal = i.source_ordinal)",
    "  where e.import_run_id is distinct from i.import_run_id",
    "    or e.source_row_key is distinct from i.source_row_key",
    "    or e.source_ordinal is distinct from i.source_ordinal",
    "    or e.row_sha256 is distinct from i.row_sha256",
    "    or e.row_payload is distinct from i.row_payload",
    "    or e.row_document is distinct from i.row_payload::jsonb",
    ") then 1 else 0 end from (select count(*) from written) applied;",
    "update legacy_recipe_staging.import_batches set batch_status = 'applied',",
    "  attempt_count = attempt_count + 1, applied_at = now(), updated_at = now(),",
    "  last_error_code = null",
    `where import_batch_id = ${sqlLiteral(batchId)}::uuid;`,
    "update legacy_recipe_staging.import_runs set checkpoint = checkpoint ||",
    `  jsonb_build_object(${sqlLiteral(entry.file)}, greatest(coalesce(`,
    `    (checkpoint ->> ${sqlLiteral(entry.file)})::bigint, 0), ${rows.at(-1)?.ordinal})),`,
    "  updated_at = now()",
    `where import_run_id = ${sqlLiteral(pkg.importRunId)}::uuid;`,
    "commit;",
    "",
  ].join("\n")
}
