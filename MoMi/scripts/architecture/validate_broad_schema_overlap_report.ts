import Ajv2020 from "ajv/dist/2020.js"

import { canonicalJson } from "../dev_loop/canonical_json.ts"
import type {
  BroadSchemaOverlapReport,
  BroadSchemaOverlapReportDiagnostic,
} from "./broad_schema_overlap_report_types.ts"
import { broadSchemaOverlapReportRowIdentity } from
  "./broad_schema_overlap_report_row_identity.ts"
import { calculateBroadSchemaOverlapReportDigest } from
  "./calculate_broad_schema_overlap_report_digest.ts"
import { calculateBroadSchemaOverlapReportInputDigest } from
  "./calculate_broad_schema_overlap_report_input_digest.ts"
import { compareUtf16 } from "./compare_utf16.ts"

export function validateBroadSchemaOverlapReport(
  value: unknown,
  schema: object,
): BroadSchemaOverlapReportDiagnostic[] {
  const diagnostics: BroadSchemaOverlapReportDiagnostic[] = []
  const raw = value as Partial<BroadSchemaOverlapReport>
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema)
  if (!validate(value)) {
    for (const error of validate.errors ?? []) diagnostics.push({
      field_path: error.instancePath || "/",
      code: "broad_overlap_report_schema_invalid",
      target: `${error.keyword}:${error.message ?? "invalid"}`,
    })
    return diagnostics.sort((left, right) =>
      compareUtf16(canonicalJson(left), canonicalJson(right)))
  }
  const report = raw as BroadSchemaOverlapReport
  if (report.input_digest !==
    calculateBroadSchemaOverlapReportInputDigest(report.inputs)) {
    diagnostics.push({ field_path: "/input_digest",
      code: "broad_overlap_report_digest_mismatch",
      target: report.input_digest })
  }
  for (const [index, row] of report.rows.entries()) {
    if (row.row_identity !== broadSchemaOverlapReportRowIdentity(row) ||
      (row.exact_relation !== null &&
        row.exact_relation.schema !== row.broad_schema)) {
      diagnostics.push({ field_path: `/rows/${index}/row_identity`,
        code: "broad_overlap_report_identity_mismatch",
        target: row.row_identity })
    }
    const sentinel = row.classification === "undiscoverable"
    const concrete = row.exact_relation !== null && row.owner_service !== null &&
      row.relation_kind !== null && row.object_source !== null
    const sameOwner = concrete && row.owner_service === row.declaring_service
    const debt = row.debt_fingerprints
    const validClass = sentinel
      ? row.exact_relation === null && row.owner_service === null &&
        row.relation_kind === null && row.object_source === null && debt.length === 0
      : concrete && (row.classification === "same-owner"
        ? sameOwner && debt.length === 0
        : row.classification === "known-direct-debt"
          ? !sameOwner && debt.length > 0
          : !sameOwner && debt.length === 0)
    if (!validClass) diagnostics.push({
      field_path: `/rows/${index}/classification`,
      code: "broad_overlap_report_identity_mismatch",
      target: row.classification,
    })
    const sortedDebt = [...new Set(debt)].sort(compareUtf16)
    if (canonicalJson(debt) !== canonicalJson(sortedDebt)) diagnostics.push({
      field_path: `/rows/${index}/debt_fingerprints`,
      code: "broad_overlap_report_noncanonical", target: row.row_identity,
    })
  }
  const identities = report.rows.map((row) => row.row_identity)
  if (new Set(identities).size !== identities.length || canonicalJson(identities) !==
    canonicalJson([...identities].sort(compareUtf16))) diagnostics.push({
      field_path: "/rows", code: "broad_overlap_report_noncanonical",
      target: "row_identity:canonical_utf16_order_required",
    })
  const declarationCount = new Set(report.rows.map((row) => canonicalJson([
    row.declaring_service, row.compatibility_mode, row.broad_schema,
  ]))).size
  const counts = {
    broad_declarations: declarationCount,
    rows: report.rows.length,
    same_owner: report.rows.filter((row) =>
      row.classification === "same-owner").length,
    cross_owner: report.rows.filter((row) =>
      row.classification === "cross-owner").length,
    known_direct_debt: report.rows.filter((row) =>
      row.classification === "known-direct-debt").length,
    undiscoverable: report.rows.filter((row) =>
      row.classification === "undiscoverable").length,
  }
  if (canonicalJson(counts) !== canonicalJson(report.counts)) diagnostics.push({
    field_path: "/counts", code: "broad_overlap_report_count_mismatch",
    target: canonicalJson(report.counts),
  })
  if (report.report_digest !== calculateBroadSchemaOverlapReportDigest(report)) {
    diagnostics.push({ field_path: "/report_digest",
      code: "broad_overlap_report_digest_mismatch",
      target: report.report_digest })
  }
  return [...new Map(diagnostics.map((item) =>
    [canonicalJson(item), item])).values()].sort((left, right) =>
      compareUtf16(canonicalJson(left), canonicalJson(right)))
}
