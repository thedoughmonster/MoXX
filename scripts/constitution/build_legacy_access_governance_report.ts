import { createHash } from "node:crypto"

import { canonicalJson } from "../dev_loop/canonical_json.ts"
import type {
  LegacyAccessGovernanceReport,
  LegacyAccessGovernanceReportBuildInput,
} from "./legacy_access_governance_report_types.ts"
import { parseLegacyAccessGovernanceReportSource } from
  "./parse_legacy_access_governance_report_source.ts"
import { projectLegacyAccessGovernanceReportFindings } from
  "./project_legacy_access_governance_report_findings.ts"

export function buildLegacyAccessGovernanceReport(
  input: LegacyAccessGovernanceReportBuildInput,
): LegacyAccessGovernanceReport {
  const baseline = parseLegacyAccessGovernanceReportSource(
    input.sourceText, input.sourceSchema, input.trustedFingerprints,
  )
  const findings = projectLegacyAccessGovernanceReportFindings(baseline.findings)
  const ruleCounts = {
    direct_private_relation_access: 0,
    direct_private_routine_call: 0,
    dynamic_event_name: 0,
    dynamic_relation_identifier: 0,
  }
  for (const finding of findings) {
    ruleCounts[finding.rule_id as keyof typeof ruleCounts] += 1
  }
  const bytes = Buffer.from(input.sourceText, "utf8")
  const report = {
    $schema:
      "https://momi.local/schemas/legacy-access-governance-report-v1.schema.json",
    schema_version: "legacy-access-governance-report/v1",
    artifact_kind: "legacy_access_governance_report",
    semantics: "legacy_debt_evidence_only",
    source: {
      repository: "thedoughmonster/momi-backend",
      path: "docs/service-access-debt-baseline.json",
      git_blob: createHash("sha1").update(
        Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]),
      ).digest("hex"),
      schema_id: "https://momi.local/schemas/service-access-debt-baseline-v1.schema.json",
      schema_version: "service-access-debt-baseline/v1",
      generated_from: baseline.generated_from,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      finding_count: findings.length,
      rule_counts: ruleCounts,
    },
    findings_sha256: createHash("sha256").update(canonicalJson(findings)).digest("hex"),
    report_digest: "",
    findings,
  } as LegacyAccessGovernanceReport
  const { $schema: _schema, report_digest: _digest, ...digestPayload } = report
  report.report_digest = createHash("sha256").update(
    canonicalJson(digestPayload),
  ).digest("hex")
  return report
}
