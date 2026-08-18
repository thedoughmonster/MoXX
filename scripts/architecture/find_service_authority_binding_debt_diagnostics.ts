import { compareUtf16 } from "./compare_utf16.ts"
import type {
  ServiceAuthorityBinding,
  ServiceAuthorityBindingContext,
  ServiceAuthorityBindingDiagnostic,
} from "./service_authority_binding_types.ts"

export function findServiceAuthorityBindingDebtDiagnostics(
  binding: ServiceAuthorityBinding,
  context: ServiceAuthorityBindingContext,
): ServiceAuthorityBindingDiagnostic[] {
  const diagnostics: ServiceAuthorityBindingDiagnostic[] = []
  const reference = binding.legacy_debt
  const report = (code: string, target: string) => diagnostics.push({
    service: binding.service, layer: "debt",
    source_path: reference.source_path, json_pointer: "/finding_fingerprints",
    code, target, message: `${code}: ${target}`,
  })
  if (reference.source_path !== context.debt.source_path) {
    report("missing_source", reference.source_path)
  }
  if (reference.source_schema_id !== context.debt.schema_id ||
    reference.source_schema_version !== "service-access-debt-baseline/v1") {
    report("source_schema_mismatch", reference.source_schema_id)
  }
  if (reference.source_digest !== context.debt.source_digest) {
    report("source_digest_drift", reference.source_digest)
  }
  const expected = context.debt.findings.filter((finding) =>
    finding.evidence.consumer_service === binding.service ||
    finding.evidence.service_key === binding.service ||
    finding.subject.startsWith(`services/${binding.service}/`)
  ).map((finding) => finding.fingerprint).sort(compareUtf16)
  const selected = reference.finding_fingerprints
  if (selected.some((item, index) =>
    index > 0 && compareUtf16(selected[index - 1], item) > 0)) {
    report("collection_unsorted", "/finding_fingerprints")
  }
  const expectedSet = new Set(expected)
  const selectedSet = new Set(selected)
  for (const fingerprint of selected) {
    if (!expectedSet.has(fingerprint)) {
      report("unrecognized_fingerprint", fingerprint)
    }
  }
  for (const fingerprint of expected) {
    if (!selectedSet.has(fingerprint)) {
      report("debt_reference_incomplete", fingerprint)
    }
  }
  return diagnostics
}
