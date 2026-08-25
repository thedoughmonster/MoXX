import { canonicalJson } from "../dev_loop/canonical_json.ts"
import type { BroadSchemaOverlapReport } from
  "./broad_schema_overlap_report_types.ts"

export function renderBroadSchemaOverlapReport(
  report: BroadSchemaOverlapReport,
): string {
  return `${canonicalJson(report)}\n`
}
