import type { ConstitutionBaseline } from "./types.ts"

type LegacyAccessGovernanceFindingIdentity = {
  fingerprint: string
  rule_version: 1
  subject: string
}

export type LegacyAccessRelationFinding =
  LegacyAccessGovernanceFindingIdentity & {
    rule_id: "direct_private_relation_access"
    consumer_service: string
    owner_service: string
    object: { kind: "relation"; identity: string }
    access_mode: "read" | "write"
    reference_count: string
    sql_source_hash: string
  }

export type LegacyAccessRoutineFinding =
  LegacyAccessGovernanceFindingIdentity & {
    rule_id: "direct_private_routine_call"
    consumer_service: string
    owner_service: string
    object: { kind: "routine"; identity: string }
    access_mode: "call"
    access_mode_basis: "direct_private_routine_call/v1"
    reference_count: string
    sql_source_hash: string
  }

export type LegacyAccessDynamicEventFinding =
  LegacyAccessGovernanceFindingIdentity & {
    rule_id: "dynamic_event_name"
    service_key: string
    expressions: string
    access_projection: "unavailable_from_source"
    service_source_hash: string
  }

export type LegacyAccessDynamicRelationFinding =
  LegacyAccessGovernanceFindingIdentity & {
    rule_id: "dynamic_relation_identifier"
    service_key: string
    expressions: string
    access_projection: "unavailable_from_source"
    service_source_hash: string
  }

export type LegacyAccessGovernanceFinding =
  | LegacyAccessRelationFinding
  | LegacyAccessRoutineFinding
  | LegacyAccessDynamicEventFinding
  | LegacyAccessDynamicRelationFinding

export type LegacyAccessGovernanceRuleCounts = {
  direct_private_relation_access: number
  direct_private_routine_call: number
  dynamic_event_name: number
  dynamic_relation_identifier: number
}

export type LegacyAccessGovernanceReport = {
  $schema: "https://momi.local/schemas/legacy-access-governance-report-v1.schema.json"
  schema_version: "legacy-access-governance-report/v1"
  artifact_kind: "legacy_access_governance_report"
  semantics: "legacy_debt_evidence_only"
  source: {
    repository: "thedoughmonster/momi-backend"
    path: "docs/service-access-debt-baseline.json"
    git_blob: string
    schema_id: "https://momi.local/schemas/service-access-debt-baseline-v1.schema.json"
    schema_version: "service-access-debt-baseline/v1"
    generated_from: string
    sha256: string
    finding_count: number
    rule_counts: LegacyAccessGovernanceRuleCounts
  }
  findings_sha256: string
  report_digest: string
  findings: LegacyAccessGovernanceFinding[]
}

export type LegacyAccessGovernanceReportBuildInput = {
  sourceText: string
  sourceSchema: object
  trustedFingerprints: Set<string>
}

export type ParsedLegacyAccessGovernanceReportSource = ConstitutionBaseline
