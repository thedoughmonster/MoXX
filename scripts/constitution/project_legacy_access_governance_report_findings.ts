import { compareUtf16 } from "../architecture/compare_utf16.ts"
import type { ConstitutionFinding } from "./types.ts"
import type { LegacyAccessGovernanceFinding } from
  "./legacy_access_governance_report_types.ts"

export function projectLegacyAccessGovernanceReportFindings(
  source: ConstitutionFinding[],
): LegacyAccessGovernanceFinding[] {
  const rows = source.map((finding) => {
    const evidence = finding.evidence
    const keys = Object.keys(evidence).sort(compareUtf16)
    const direct = {
      fingerprint: finding.fingerprint, rule_version: finding.rule_version,
      rule_id: finding.rule_id, subject: finding.subject,
    }
    if (finding.rule_id === "direct_private_relation_access") {
      const expected = ["access", "consumer_service", "owner_service",
        "reference_count", "relation", "sql_source_hash"]
      if (JSON.stringify(keys) !== JSON.stringify(expected)) {
        throw new Error("legacy_report_known_variant_incomplete")
      }
      if (evidence.access !== "read" && evidence.access !== "write") {
        throw new Error("legacy_report_access_mode_unsupported")
      }
      return { ...direct, consumer_service: evidence.consumer_service,
        owner_service: evidence.owner_service,
        object: { kind: "relation" as const, identity: evidence.relation },
        access_mode: evidence.access, reference_count: evidence.reference_count,
        sql_source_hash: evidence.sql_source_hash }
    }
    if (finding.rule_id === "direct_private_routine_call") {
      const expected = ["consumer_service", "owner_service", "reference_count",
        "routine", "sql_source_hash"]
      if (JSON.stringify(keys) !== JSON.stringify(expected)) {
        throw new Error("legacy_report_known_variant_incomplete")
      }
      return { ...direct, consumer_service: evidence.consumer_service,
        owner_service: evidence.owner_service,
        object: { kind: "routine" as const, identity: evidence.routine },
        access_mode: "call" as const,
        access_mode_basis: "direct_private_routine_call/v1" as const,
        reference_count: evidence.reference_count,
        sql_source_hash: evidence.sql_source_hash }
    }
    const expected = ["expressions", "service_key", "service_source_hash"]
    if (JSON.stringify(keys) !== JSON.stringify(expected)) {
      throw new Error("legacy_report_known_variant_incomplete")
    }
    return { ...direct, service_key: evidence.service_key,
      expressions: evidence.expressions,
      access_projection: "unavailable_from_source" as const,
      service_source_hash: evidence.service_source_hash }
  })
  return rows.sort((left, right) => compareUtf16(left.fingerprint, right.fingerprint))
}
