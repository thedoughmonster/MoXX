import { fingerprintRows } from "./fingerprint_rows.ts"
import { sqlLiteral } from "./sql_literal.ts"
import { stableUuid } from "./stable_uuid.ts"
import type { FingerprintRow, LoadedExport, LoadedPackage, RepairFinding } from "./types.ts"

export function buildFindingBatchSql(
  pkg: LoadedPackage,
  item: LoadedExport,
  rows: RepairFinding[],
  batchOrdinal: number,
): string {
  const entry = item.manifest
  const batchKey = `${entry.file}#${String(batchOrdinal).padStart(6, "0")}`
  const batchId = stableUuid(`batch:${pkg.importRunId}:${batchKey}`)
  const payload = fingerprintRows(rows.map((row): FingerprintRow => ({
    ordinal: row.ordinal, key: row.finding_key, sha256: row.finding_sha256,
  })))
  const values = rows.map((row) => [
    `${sqlLiteral(stableUuid(`finding:${pkg.importRunId}:${row.finding_key}`))}::uuid`,
    `${sqlLiteral(pkg.importRunId)}::uuid`, `${sqlLiteral(item.sourceFileId)}::uuid`,
    sqlLiteral(row.finding_key), String(row.ordinal), sqlLiteral(row.category),
    sqlLiteral(row.severity), sqlLiteral(row.source_table ?? null),
    sqlLiteral(row.source_key ?? null), sqlLiteral(row.finding_sha256),
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
    "with incoming (repair_finding_id, import_run_id, source_file_id, finding_key,",
    "  finding_ordinal, finding_category, severity, source_table_key, source_row_key,",
    "  finding_sha256, finding_payload) as (values",
    values,
    "), written as (",
    "  insert into legacy_recipe_staging.repair_findings (",
    "    repair_finding_id, import_run_id, source_file_id, finding_key,",
    "    finding_ordinal, finding_category, severity, source_table_key,",
    "    source_row_key, finding_sha256, finding_payload, finding_document",
    "  ) select i.*, i.finding_payload::jsonb from incoming i",
    "  on conflict do nothing returning repair_finding_id",
    ") select 1 / case when not exists (",
    "  select 1 from incoming i join legacy_recipe_staging.repair_findings e",
    "    on e.source_file_id = i.source_file_id and (",
    "      e.repair_finding_id = i.repair_finding_id or e.finding_key = i.finding_key",
    "      or e.finding_ordinal = i.finding_ordinal)",
    "  where e.import_run_id is distinct from i.import_run_id",
    "    or e.finding_key is distinct from i.finding_key",
    "    or e.finding_ordinal is distinct from i.finding_ordinal",
    "    or e.finding_sha256 is distinct from i.finding_sha256",
    "    or e.finding_payload is distinct from i.finding_payload",
    "    or e.finding_document is distinct from i.finding_payload::jsonb",
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
