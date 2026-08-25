import { checkCurrentLegacyAccessGovernanceReport } from
  "./constitution/check_current_legacy_access_governance_report.ts"

await checkCurrentLegacyAccessGovernanceReport()
console.log("Legacy access governance report is current and valid.")
