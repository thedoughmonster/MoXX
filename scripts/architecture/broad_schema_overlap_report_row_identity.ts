import { canonicalJson } from "../dev_loop/canonical_json.ts"
import type { BroadSchemaOverlapRow } from
  "./broad_schema_overlap_report_types.ts"

export function broadSchemaOverlapReportRowIdentity(
  row: Pick<BroadSchemaOverlapRow, "declaring_service" |
    "compatibility_mode" | "broad_schema" | "exact_relation" |
    "owner_service">,
): string {
  return canonicalJson([row.declaring_service, row.compatibility_mode,
    row.broad_schema, canonicalJson(row.exact_relation), row.owner_service])
}
