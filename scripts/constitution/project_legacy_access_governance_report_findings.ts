import { compareUtf16 } from "../architecture/compare_utf16.ts"
import type { ConstitutionFinding } from "./types.ts"
import type { LegacyAccessGovernanceFinding } from
  "./legacy_access_governance_report_types.ts"

export function projectLegacyAccessGovernanceReportFindings(
  source: ConstitutionFinding[],
): LegacyAccessGovernanceFinding[] {
  const rows: LegacyAccessGovernanceFinding[] = source.map((finding) => {
    const evidence = finding.evidence
    const keys = Object.keys(evidence).sort(compareUtf16)
    if (finding.rule_id === "direct_private_relation_access") {
      const expected = ["access", "consumer_service", "owner_service",
        "reference_count", "relation", "sql_source_hash"]
      if (JSON.stringify(keys) !== JSON.stringify(expected)) {
        throw new Error("legacy_report_known_variant_incomplete")
      }
      if (evidence.access !== "read" && evidence.access !== "write") {
        throw new Error("legacy_report_access_mode_unsupported")
      }
      return { fingerprint: finding.fingerprint, rule_version: 1,
        rule_id: "direct_private_relation_access", subject: finding.subject,
        consumer_service: evidence.consumer_service,
        owner_service: evidence.owner_service,
        object: { kind: "relation", identity: evidence.relation },
        access_mode: evidence.access, reference_count: evidence.reference_count,
        sql_source_hash: evidence.sql_source_hash }
    }
    if (finding.rule_id === "direct_private_routine_call") {
      const expected = ["consumer_service", "owner_service", "reference_count",
        "routine", "sql_source_hash"]
      if (JSON.stringify(keys) !== JSON.stringify(expected)) {
        throw new Error("legacy_report_known_variant_incomplete")
      }
      return { fingerprint: finding.fingerprint, rule_version: 1,
        rule_id: "direct_private_routine_call", subject: finding.subject,
        consumer_service: evidence.consumer_service,
        owner_service: evidence.owner_service,
        object: { kind: "routine", identity: evidence.routine },
        access_mode: "call",
        access_mode_basis: "direct_private_routine_call/v1",
        reference_count: evidence.reference_count,
        sql_source_hash: evidence.sql_source_hash }
    }
    if (finding.rule_id !== "dynamic_event_name" &&
      finding.rule_id !== "dynamic_relation_identifier") {
      throw new Error("legacy_report_finding_kind_unsupported")
    }
    const expected = ["expressions", "service_key", "service_source_hash"]
    if (JSON.stringify(keys) !== JSON.stringify(expected)) {
      throw new Error("legacy_report_known_variant_incomplete")
    }
    return { fingerprint: finding.fingerprint, rule_version: 1,
      rule_id: finding.rule_id, subject: finding.subject,
      service_key: evidence.service_key,
      expressions: evidence.expressions,
      access_projection: "unavailable_from_source",
      service_source_hash: evidence.service_source_hash }
  })
  return rows.sort((left, right) => compareUtf16(left.fingerprint, right.fingerprint))
}
