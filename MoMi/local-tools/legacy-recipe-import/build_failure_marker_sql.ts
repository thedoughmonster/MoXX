import { sqlLiteral } from "./sql_literal.ts"

export function buildFailureMarkerSql(
  importRunId: string,
  phase: "import" | "verification",
): string {
  const run = `${sqlLiteral(importRunId)}::uuid`
  const status = phase === "import" ? "failed" : "verification_failed"
  const code = phase === "import" ? "execution_failed" : "verification_execution_failed"
  return [
    `-- legacy-recipe-${phase}: sealed failure marker`,
    "begin;",
    "update legacy_recipe_staging.import_runs set",
    `  run_status = ${sqlLiteral(status)},`,
    "  completed_at = null,",
    "  failure_count = failure_count + 1,",
    `  last_error_code = ${sqlLiteral(code)},`,
    "  last_error_at = now(),",
    "  updated_at = now()",
    `where import_run_id = ${run};`,
    "commit;",
    "select jsonb_build_object(",
    "  'legacy_recipe_status', run_status",
    ")::text as legacy_recipe_result",
    "from legacy_recipe_staging.import_runs",
    `where import_run_id = ${run};`,
    "",
  ].join("\n")
}
