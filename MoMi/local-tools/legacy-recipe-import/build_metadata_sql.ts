import { jsonSql } from "./json_sql.ts"
import { sqlLiteral } from "./sql_literal.ts"
import type { JsonValue, LoadedPackage } from "./types.ts"

export function buildMetadataSql(pkg: LoadedPackage): string {
  const lines = ["-- legacy-recipe-import: source metadata", "begin;"]
  for (const item of pkg.exports) {
    const entry = item.manifest
    const manifestEntry = jsonSql(entry as unknown as JsonValue)
    lines.push(
      "insert into legacy_recipe_staging.source_files (",
      "  source_file_id, import_run_id, relative_path, file_kind, export_format,",
      "  byte_count, file_sha256, expected_row_count, rows_sha256, manifest_entry",
      ") values (",
      `  ${sqlLiteral(item.sourceFileId)}::uuid, ${sqlLiteral(pkg.importRunId)}::uuid,`,
      `  ${sqlLiteral(entry.file)}, ${sqlLiteral(entry.kind)}, ${sqlLiteral(entry.format)},`,
      `  ${entry.bytes}, ${sqlLiteral(entry.sha256)}, ${entry.row_count},`,
      `  ${sqlLiteral(entry.rows_sha256)}, ${manifestEntry}`,
      ") on conflict do nothing;",
      "select 1 / case when exists (",
      "  select 1 from legacy_recipe_staging.source_files",
      `  where source_file_id = ${sqlLiteral(item.sourceFileId)}::uuid`,
      `    and import_run_id = ${sqlLiteral(pkg.importRunId)}::uuid`,
      `    and relative_path = ${sqlLiteral(entry.file)}`,
      `    and file_sha256 = ${sqlLiteral(entry.sha256)}`,
      `    and byte_count = ${entry.bytes} and expected_row_count = ${entry.row_count}`,
      `    and rows_sha256 = ${sqlLiteral(entry.rows_sha256)}`,
      `    and manifest_entry = ${manifestEntry}`,
      ") then 1 else 0 end;",
    )
    if (entry.kind === "source_table") {
      const descriptor = jsonSql(entry.source as unknown as JsonValue)
      lines.push(
        "insert into legacy_recipe_staging.source_tables (",
        "  source_table_id, import_run_id, source_file_id, source_database,",
        "  source_table_key, expected_row_count, rows_sha256, source_descriptor",
        ") values (",
        `  ${sqlLiteral(item.sourceTableId ?? "")}::uuid,`,
        `  ${sqlLiteral(pkg.importRunId)}::uuid, ${sqlLiteral(item.sourceFileId)}::uuid,`,
        `  ${sqlLiteral(entry.source?.database ?? "")},`,
        `  ${sqlLiteral(entry.source?.table ?? "")}, ${entry.row_count},`,
        `  ${sqlLiteral(entry.rows_sha256)}, ${descriptor}`,
        ") on conflict do nothing;",
        "select 1 / case when exists (",
        "  select 1 from legacy_recipe_staging.source_tables",
        `  where source_table_id = ${sqlLiteral(item.sourceTableId ?? "")}::uuid`,
        `    and import_run_id = ${sqlLiteral(pkg.importRunId)}::uuid`,
        `    and source_file_id = ${sqlLiteral(item.sourceFileId)}::uuid`,
        `    and source_database = ${sqlLiteral(entry.source?.database ?? "")}`,
        `    and source_table_key = ${sqlLiteral(entry.source?.table ?? "")}`,
        `    and expected_row_count = ${entry.row_count}`,
        `    and rows_sha256 = ${sqlLiteral(entry.rows_sha256)}`,
        `    and source_descriptor = ${descriptor}`,
        ") then 1 else 0 end;",
      )
    }
  }
  lines.push("commit;", "")
  return lines.join("\n")
}
