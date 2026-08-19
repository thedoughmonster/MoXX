import type { LegacyAccessGovernanceReport } from
  "./legacy_access_governance_report_types.ts"

export function renderLegacyAccessGovernanceReport(
  report: LegacyAccessGovernanceReport,
): string {
  return `${JSON.stringify(report)}\n`
}
