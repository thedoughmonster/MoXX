import { createHash } from "node:crypto"

import { validateJson } from "../architecture/validate_json.ts"
import { canonicalJson } from "../dev_loop/canonical_json.ts"
import type { LegacyAccessGovernanceReport } from
  "./legacy_access_governance_report_types.ts"

export function validateLegacyAccessGovernanceReport(
  value: unknown,
  schema: object,
  expected: LegacyAccessGovernanceReport,
): void {
  try {
    validateJson(schema, value, "legacy access governance report")
  } catch (error) {
    throw new Error("legacy_report_known_variant_incomplete", { cause: error })
  }
  const report = value as LegacyAccessGovernanceReport
  if (canonicalJson(report.source) !== canonicalJson(expected.source)) {
    throw new Error("legacy_report_provenance_incomplete")
  }
  const fingerprints = report.findings.map((finding) => finding.fingerprint)
  const expectedFingerprints = expected.findings.map((finding) => finding.fingerprint)
  if (new Set(fingerprints).size !== fingerprints.length) {
    throw new Error("legacy_report_fingerprint_duplicate")
  }
  if (canonicalJson(fingerprints) !== canonicalJson([...fingerprints].sort())) {
    throw new Error("legacy_report_finding_identity_invalid")
  }
  if (canonicalJson(fingerprints) !== canonicalJson(expectedFingerprints)) {
    throw new Error("legacy_report_fingerprint_set_mismatch")
  }
  const counts = Object.fromEntries(Object.keys(expected.source.rule_counts).map(
    (rule) => [rule, report.findings.filter((finding) => finding.rule_id === rule).length],
  ))
  if (report.source.finding_count !== report.findings.length ||
    canonicalJson(counts) !== canonicalJson(report.source.rule_counts)) {
    throw new Error("legacy_report_count_mismatch")
  }
  const findingsDigest = createHash("sha256").update(
    canonicalJson(report.findings),
  ).digest("hex")
  const { $schema: _schema, report_digest: _digest, ...digestPayload } = report
  const reportDigest = createHash("sha256").update(
    canonicalJson(digestPayload),
  ).digest("hex")
  if (report.findings_sha256 !== findingsDigest ||
    report.report_digest !== reportDigest) {
    throw new Error("legacy_report_digest_mismatch")
  }
}
