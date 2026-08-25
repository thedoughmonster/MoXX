import { IMPORTER_VERSION } from "./constants.ts"
import { jsonSql } from "./json_sql.ts"
import { sqlLiteral } from "./sql_literal.ts"
import type { JsonValue, LoadedPackage } from "./types.ts"

export function buildRunSql(pkg: LoadedPackage, expectedBatchCount: number): string {
  const sourceRows = pkg.manifest.exports.filter((entry) =>
    entry.kind === "source_table"
  ).reduce((total, entry) => total + entry.row_count, 0)
  const findings = pkg.manifest.exports.filter((entry) =>
    entry.kind === "repair_findings"
  ).reduce((total, entry) => total + entry.row_count, 0)
  const manifest = jsonSql(pkg.rawManifest as unknown as JsonValue)
  const values = [
    `${sqlLiteral(pkg.importRunId)}::uuid`, sqlLiteral(pkg.manifest.package_id),
    sqlLiteral(pkg.manifestSha256), sqlLiteral(pkg.ledgerSha256),
    `${sqlLiteral(pkg.manifest.created_at)}::timestamptz`,
    sqlLiteral(IMPORTER_VERSION), String(pkg.exports.length),
    String(expectedBatchCount), String(sourceRows), String(findings), manifest,
  ].join(", ")
  return [
    "-- legacy-recipe-import: import run",
    "begin;",
    "insert into legacy_recipe_staging.import_runs (",
    "  import_run_id, source_package_id, manifest_sha256, checksum_ledger_sha256,",
    "  package_created_at,",
    "  importer_version, expected_file_count, expected_batch_count,",
    "  expected_source_row_count, expected_finding_count, manifest",
    `) values (${values}) on conflict do nothing;`,
    "select 1 / case when exists (",
    "  select 1 from legacy_recipe_staging.import_runs",
    `  where import_run_id = ${sqlLiteral(pkg.importRunId)}::uuid`,
    `    and source_package_id = ${sqlLiteral(pkg.manifest.package_id)}`,
    `    and manifest_sha256 = ${sqlLiteral(pkg.manifestSha256)}`,
    `    and checksum_ledger_sha256 = ${sqlLiteral(pkg.ledgerSha256)}`,
    `    and package_created_at = ${sqlLiteral(pkg.manifest.created_at)}::timestamptz`,
    `    and importer_version = ${sqlLiteral(IMPORTER_VERSION)}`,
    `    and expected_file_count = ${pkg.exports.length}`,
    `    and expected_batch_count = ${expectedBatchCount}`,
    `    and expected_source_row_count = ${sourceRows}`,
    `    and expected_finding_count = ${findings} and manifest = ${manifest}`,
    ") then 1 else 0 end;",
    "update legacy_recipe_staging.import_runs",
    "set run_status = 'running', resumed_at = now(), updated_at = now(),",
    "  last_error_code = null, last_error_at = null",
    `where import_run_id = ${sqlLiteral(pkg.importRunId)}::uuid;`,
    "commit;",
    "",
  ].join("\n")
}
