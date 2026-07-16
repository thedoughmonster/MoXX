import { sqlLiteral } from "./sql_literal.ts"
import type { LoadedPackage } from "./types.ts"

export function buildVerifyCompleteSql(pkg: LoadedPackage): string {
  const checks = pkg.exports.flatMap((item) => [
    `file:${item.manifest.file}`, `rows:${item.manifest.file}`,
  ])
  const values = checks.map((check) => `  (${sqlLiteral(check)}::text)`).join(",\n")
  const run = `${sqlLiteral(pkg.importRunId)}::uuid`
  return [
    "-- legacy-recipe-verify: final status",
    "begin;",
    "with expected(check_key) as (values",
    values,
    "), latest as (",
    "  select distinct on (r.check_key) r.check_key, r.passed",
    "  from legacy_recipe_staging.reconciliation_results r",
    `  where r.import_run_id = ${run}`,
    "  order by r.check_key, r.checked_at desc, r.reconciliation_result_id desc",
    "), outcome as (",
    "  select count(l.check_key) = (select count(*) from expected)",
    "    and bool_and(l.passed) as passed",
    "  from expected e left join latest l using (check_key)",
    "), updated as (",
    "  update legacy_recipe_staging.import_runs r set",
    "    run_status = case when o.passed then 'verified' else 'verification_failed' end,",
    "    completed_at = case when o.passed then now() else null end,",
    "    updated_at = now(),",
    "    last_error_code = case when o.passed then null else 'verification_failed' end,",
    "    last_error_at = case when o.passed then null else now() end",
    `  from outcome o where r.import_run_id = ${run}`,
    "  returning r.import_run_id",
    ") select count(*) from updated;",
    "commit;",
    "select jsonb_build_object(",
    "  'legacy_recipe_status', run_status",
    ")::text as legacy_recipe_result",
    "from legacy_recipe_staging.import_runs",
    `where import_run_id = ${run};`,
    "",
  ].join("\n")
}
