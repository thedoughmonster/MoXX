import type { DatabaseObjectIdentity } from
  "./database_object_authority_types.ts"

export type BroadSchemaOverlapClassification =
  | "same-owner" | "cross-owner" | "known-direct-debt" | "undiscoverable"

export type BroadSchemaOverlapRow = {
  row_identity: string
  declaring_service: string
  compatibility_mode: "database.read" | "database.write"
  broad_schema: string
  declaration_source: { source_path: string; json_pointer: string }
  exact_relation: Extract<DatabaseObjectIdentity, { class: "relation" }> | null
  owner_service: string | null
  relation_kind: "table" | "view" | "materialized view" | null
  object_source: {
    source_path: string; json_pointer: string; replay_identity: string
  } | null
  classification: BroadSchemaOverlapClassification
  debt_fingerprints: string[]
}

export type BroadSchemaOverlapInputs = {
  database_object_authority: {
    schema_version: "database-object-authority/v1"
    repository: string
    revision: string
    source_digest: string
    authority_digest: string
  }
  legacy_debt_baseline: {
    path: string; schema_version: string; digest: string
  }
}

export type BroadSchemaOverlapReport = {
  $schema: "https://momi.local/schemas/broad-schema-overlap-report-v1.schema.json"
  schema_version: "broad-schema-overlap-report/v1"
  artifact_kind: "broad_schema_overlap_report"
  semantics: "diagnostic_evidence_only"
  inputs: BroadSchemaOverlapInputs
  input_digest: string
  counts: {
    broad_declarations: number
    rows: number
    same_owner: number
    cross_owner: number
    known_direct_debt: number
    undiscoverable: number
  }
  rows: BroadSchemaOverlapRow[]
  report_digest: string
}

export type BroadSchemaOverlapReportDiagnostic = {
  field_path: string
  code: "broad_overlap_debt_reference_mismatch" |
    "broad_overlap_report_schema_invalid" |
    "broad_overlap_report_identity_mismatch" |
    "broad_overlap_report_count_mismatch" |
    "broad_overlap_report_digest_mismatch" |
    "broad_overlap_report_noncanonical"
  target: string
}
