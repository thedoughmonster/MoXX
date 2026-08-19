import { createHash } from "node:crypto"

import { canonicalJson } from "../dev_loop/canonical_json.ts"
import type { BroadSchemaOverlapInputs } from
  "./broad_schema_overlap_report_types.ts"

export function calculateBroadSchemaOverlapReportInputDigest(
  inputs: BroadSchemaOverlapInputs,
): string {
  return createHash("sha256").update(canonicalJson(inputs)).digest("hex")
}
