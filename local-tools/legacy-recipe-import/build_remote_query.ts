import { sqlLiteral } from "./sql_literal.ts"
import type { LoadedExport, LoadedPackage } from "./types.ts"

export function buildRemoteQuery(pkg: LoadedPackage, item: LoadedExport): string {
  const entry = item.manifest
  const fileId = `${sqlLiteral(item.sourceFileId)}::uuid`
  const rows = entry.kind === "source_table" ? [
    "select count(*)::bigint as row_count, encode(extensions.digest(convert_to(",
    "  coalesce(string_agg(r.source_ordinal::text || E'\\t' ||",
    "    r.source_row_key || E'\\t' || encode(extensions.digest(",
    "      convert_to(r.row_payload, 'UTF8'), 'sha256'), 'hex') || E'\\n'",
    "    , '' order by r.source_ordinal), ''), 'UTF8'), 'sha256'), 'hex') as rows_sha256",
    "from legacy_recipe_staging.source_rows r",
    `where r.source_table_id = ${sqlLiteral(item.sourceTableId ?? "")}::uuid`,
  ] : [
    "select count(*)::bigint as row_count, encode(extensions.digest(convert_to(",
    "  coalesce(string_agg(r.finding_ordinal::text || E'\\t' ||",
    "    r.finding_key || E'\\t' || encode(extensions.digest(",
    "      convert_to(r.finding_payload, 'UTF8'), 'sha256'), 'hex') || E'\\n'",
    "    , '' order by r.finding_ordinal), ''), 'UTF8'), 'sha256'), 'hex') as rows_sha256",
    "from legacy_recipe_staging.repair_findings r",
    `where r.source_file_id = ${fileId}`,
  ]
  const fileCheck = `file:${entry.file}`
  const rowCheck = `rows:${entry.file}`
  return [
    `-- legacy-recipe-verify: ${entry.file}`,
    "begin;",
    "with row_evidence as (",
    ...rows,
    "), evidence as (",
    "  select f.file_sha256, f.byte_count, f.expected_row_count,",
    "    r.row_count, r.rows_sha256",
    "  from legacy_recipe_staging.source_files f cross join row_evidence r",
    `  where f.source_file_id = ${fileId}`,
    "), checks as (",
    "  select",
    `    ${sqlLiteral(fileCheck)}::text as check_key, ${entry.bytes}::bigint as expected_count,`,
    `    e.byte_count as actual_count, ${sqlLiteral(entry.sha256)}::text as expected_sha256,`,
    "    e.file_sha256 as actual_sha256,",
    `    e.byte_count = ${entry.bytes} and e.file_sha256 = ${sqlLiteral(entry.sha256)}`,
    `      and e.expected_row_count = ${entry.row_count} as passed`,
    "  from evidence e union all select",
    `    ${sqlLiteral(rowCheck)}, ${entry.row_count}::bigint, e.row_count,`,
    `    ${sqlLiteral(entry.rows_sha256)}, e.rows_sha256,`,
    `    e.row_count = ${entry.row_count} and e.rows_sha256 = ${sqlLiteral(entry.rows_sha256)}`,
    "  from evidence e",
    ") insert into legacy_recipe_staging.reconciliation_results (",
    "  reconciliation_result_id, import_run_id, check_key, expected_count,",
    "  actual_count, expected_sha256, actual_sha256, passed, details",
    ") select extensions.gen_random_uuid(),",
    `  ${sqlLiteral(pkg.importRunId)}::uuid, check_key, expected_count, actual_count,`,
    "  expected_sha256, actual_sha256, passed,",
    `  jsonb_build_object('kind', 'payload_recomputed', 'file', ${sqlLiteral(entry.file)})`,
    "from checks on conflict do nothing;",
    "commit;",
    "",
  ].join("\n")
}
