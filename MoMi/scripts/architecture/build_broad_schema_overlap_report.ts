import { createHash } from "node:crypto"

import { parseLegacyAccessGovernanceReportSource } from
  "../constitution/parse_legacy_access_governance_report_source.ts"
import { projectLegacyAccessGovernanceReportFindings } from
  "../constitution/project_legacy_access_governance_report_findings.ts"
import { calculateBroadSchemaOverlapReportDigest } from
  "./calculate_broad_schema_overlap_report_digest.ts"
import { calculateBroadSchemaOverlapReportInputDigest } from
  "./calculate_broad_schema_overlap_report_input_digest.ts"
import { calculateBroadSchemaOverlapReportRows } from
  "./calculate_broad_schema_overlap_report_rows.ts"
import type {
  BroadSchemaOverlapInputs,
  BroadSchemaOverlapReport,
} from "./broad_schema_overlap_report_types.ts"
import type { DatabaseObjectAuthority } from
  "./database_object_authority_types.ts"
import { validateDatabaseObjectAuthority } from
  "./validate_database_object_authority.ts"

export function buildBroadSchemaOverlapReport(
  authority: DatabaseObjectAuthority,
  authoritySchema: object,
  baselineText: string,
  baselineSchema: object,
  trustedFingerprints: Set<string>,
): BroadSchemaOverlapReport {
  const authorityDiagnostics = validateDatabaseObjectAuthority(
    authority, authoritySchema,
  )
  if (authorityDiagnostics.length > 0) throw new Error(
    authorityDiagnostics.map((item) => JSON.stringify(item)).join("\n"),
  )
  const baseline = parseLegacyAccessGovernanceReportSource(
    baselineText, baselineSchema, trustedFingerprints,
  )
  const digest = createHash("sha256").update(Buffer.from(
    baselineText, "utf8",
  )).digest("hex")
  const reference = authority.legacy_debt_reference
  if (reference.path !== "docs/service-access-debt-baseline.json" ||
    reference.schema_version !== "service-access-debt-baseline/v1" ||
    reference.digest !== digest || baseline.schema_version !== 1) {
    throw new Error("broad_overlap_debt_reference_mismatch")
  }
  const inputs: BroadSchemaOverlapInputs = {
    database_object_authority: {
      schema_version: authority.schema_version,
      repository: authority.repository, revision: authority.revision,
      source_digest: authority.source_digest,
      authority_digest: authority.authority_digest,
    },
    legacy_debt_baseline: { ...reference },
  }
  const rows = calculateBroadSchemaOverlapReportRows(
    authority, projectLegacyAccessGovernanceReportFindings(baseline.findings),
  )
  const report: BroadSchemaOverlapReport = {
    $schema:
      "https://momi.local/schemas/broad-schema-overlap-report-v1.schema.json",
    schema_version: "broad-schema-overlap-report/v1",
    artifact_kind: "broad_schema_overlap_report",
    semantics: "diagnostic_evidence_only", inputs,
    input_digest: calculateBroadSchemaOverlapReportInputDigest(inputs),
    counts: {
      broad_declarations: authority.runtime_compatibility.filter((item) =>
        item.scope.kind === "historical_broad_migration_debt").length,
      rows: rows.length,
      same_owner: rows.filter((row) => row.classification === "same-owner").length,
      cross_owner: rows.filter((row) => row.classification === "cross-owner").length,
      known_direct_debt: rows.filter((row) =>
        row.classification === "known-direct-debt").length,
      undiscoverable: rows.filter((row) =>
        row.classification === "undiscoverable").length,
    },
    rows, report_digest: "",
  }
  report.report_digest = calculateBroadSchemaOverlapReportDigest(report)
  return report
}
