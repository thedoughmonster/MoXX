import { canonicalJson } from "../dev_loop/canonical_json.ts"
import type { LegacyAccessGovernanceReport } from
  "./legacy_access_governance_report_types.ts"

export function renderLegacyAccessGovernanceReport(
  report: LegacyAccessGovernanceReport,
): string {
  return `${canonicalJson(report)}\n`
}
