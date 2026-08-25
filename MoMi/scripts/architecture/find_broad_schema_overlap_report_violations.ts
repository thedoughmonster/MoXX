import { join } from "node:path"

import { buildCurrentBroadSchemaOverlapReport } from
  "./build_current_broad_schema_overlap_report.ts"
import { readJson } from "./read_json.ts"
import { validateBroadSchemaOverlapReport } from
  "./validate_broad_schema_overlap_report.ts"

export async function findBroadSchemaOverlapReportViolations(
  root: string,
  revision = "HEAD",
): Promise<string[]> {
  try {
    const report = await buildCurrentBroadSchemaOverlapReport(root, revision)
    const schema = await readJson<object>(join(
      root, "schemas", "broad-schema-overlap-report-v1.schema.json",
    ))
    return validateBroadSchemaOverlapReport(report, schema).map((item) =>
      JSON.stringify(item))
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)]
  }
}
