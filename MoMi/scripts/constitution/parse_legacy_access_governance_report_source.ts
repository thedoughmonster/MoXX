import { validateJson } from "../architecture/validate_json.ts"
import { fingerprintFinding } from "./fingerprint_finding.ts"
import type { ParsedLegacyAccessGovernanceReportSource } from
  "./legacy_access_governance_report_types.ts"

export function parseLegacyAccessGovernanceReportSource(
  sourceText: string,
  schema: object,
  trustedFingerprints: Set<string>,
): ParsedLegacyAccessGovernanceReportSource {
  let value: unknown
  try {
    value = JSON.parse(sourceText)
  } catch {
    throw new Error("legacy_report_source_json_invalid")
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("legacy_report_known_variant_incomplete")
  }
  const raw = value as { schema_version?: unknown; findings?: unknown }
  if (raw.schema_version !== 1) {
    throw new Error("legacy_report_source_version_unsupported")
  }
  if (!Array.isArray(raw.findings)) {
    throw new Error("legacy_report_known_variant_incomplete")
  }
  for (const finding of raw.findings) {
    if (typeof finding !== "object" || finding === null || Array.isArray(finding)) {
      throw new Error("legacy_report_known_variant_incomplete")
    }
    const rule = (finding as { rule_id?: unknown }).rule_id
    if (![
      "direct_private_relation_access", "direct_private_routine_call",
      "dynamic_event_name", "dynamic_relation_identifier",
    ].includes(String(rule))) {
      throw new Error("legacy_report_finding_kind_unsupported")
    }
  }
  try {
    validateJson(schema, value, "legacy report source")
  } catch (error) {
    throw new Error("legacy_report_known_variant_incomplete", { cause: error })
  }
  const baseline = value as ParsedLegacyAccessGovernanceReportSource
  const fingerprints = new Set<string>()
  const identities = new Set<string>()
  for (const finding of baseline.findings) {
    const expected = fingerprintFinding(finding)
    if (finding.fingerprint !== expected || !trustedFingerprints.has(expected)) {
      throw new Error("legacy_report_finding_identity_invalid")
    }
    if (fingerprints.has(finding.fingerprint) || identities.has(expected)) {
      throw new Error("legacy_report_fingerprint_duplicate")
    }
    fingerprints.add(finding.fingerprint)
    identities.add(expected)
  }
  const sorted = [...baseline.findings].sort((left, right) => {
    const a = `${left.rule_id}\0${left.subject}\0${left.fingerprint}`
    const b = `${right.rule_id}\0${right.subject}\0${right.fingerprint}`
    return a < b ? -1 : a > b ? 1 : 0
  })
  if (sorted.some((finding, index) => finding !== baseline.findings[index])) {
    throw new Error("legacy_report_finding_identity_invalid")
  }
  return baseline
}
