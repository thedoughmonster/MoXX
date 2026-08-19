import { createHash } from "node:crypto"

import { canonicalJson } from "../dev_loop/canonical_json.ts"
import type { BroadSchemaOverlapReport } from
  "./broad_schema_overlap_report_types.ts"

export function calculateBroadSchemaOverlapReportDigest(
  report: BroadSchemaOverlapReport,
): string {
  const { $schema: _schema, report_digest: _digest, ...payload } = report
  return createHash("sha256").update(canonicalJson(payload)).digest("hex")
}
