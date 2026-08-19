import type { ConstitutionBaseline } from "./types.ts"

export type LegacyAccessGovernanceFinding = {
  fingerprint: string
  rule_version: 1
  rule_id: string
  subject: string
  consumer_service?: string
  owner_service?: string
  object?: { kind: "relation" | "routine"; identity: string }
  access_mode?: "read" | "write" | "call"
  access_mode_basis?: "direct_private_routine_call/v1"
  reference_count?: string
  sql_source_hash?: string
  service_key?: string
  expressions?: string
  access_projection?: "unavailable_from_source"
  service_source_hash?: string
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
    schema_id: string
    schema_version: "service-access-debt-baseline/v1"
    generated_from: string
    sha256: string
    finding_count: number
    rule_counts: Record<string, number>
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
