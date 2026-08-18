import { digestExecutionAuthority } from "./digest_execution_authority.ts"
import { compareUtf16 } from "./compare_utf16.ts"
import type {
  ServiceAuthorityBinding,
  ServiceAuthorityBindingContext,
  ServiceAuthorityBindingDiagnostic,
} from "./service_authority_binding_types.ts"
import { validateExecutionAuthority } from "./validate_execution_authority.ts"

export async function findServiceAuthorityBindingExecutionDiagnostics(
  binding: ServiceAuthorityBinding,
  context: ServiceAuthorityBindingContext,
): Promise<ServiceAuthorityBindingDiagnostic[]> {
  const diagnostics: ServiceAuthorityBindingDiagnostic[] = []
  const reference = binding.execution_authority
  if (!reference) return diagnostics
  const sources = [...(context.executions[reference.grant_id] ?? [])].sort(
    (left, right) => compareUtf16(left.source_path, right.source_path),
  )
  const sourcePath = sources[0]?.source_path ??
    `execution-authorities/${reference.grant_id}.json`
  const report = (json_pointer: string, code: string, target: string) => {
    diagnostics.push({ service: binding.service, layer: "execution",
      source_path: sourcePath, json_pointer, code, target,
      message: `${code}: ${target}` })
  }
  if (sources.length === 0) {
    report("/grant_id", "missing_source", reference.grant_id)
    return diagnostics
  }
  if (sources.length > 1) {
    report("/grant_id", "ambiguous_authority", reference.grant_id)
    return diagnostics
  }
  const grant = sources[0].value
  if (grant.work_item !== reference.work_item) {
    report("/work_item", "execution_identity_mismatch", reference.work_item)
  }
  if (grant.service !== binding.service) {
    report("/service", "execution_identity_mismatch", grant.service)
  }
  if (grant.base_revision !== reference.base_revision ||
    reference.base_revision !== binding.revision) {
    report("/base_revision", "base_revision_drift", reference.base_revision)
  }
  if (grant.source_digest !== reference.source_digest) {
    report("/source_digest", "source_digest_drift", reference.source_digest)
  }
  if (digestExecutionAuthority(grant) !== reference.declaration_digest) {
    report("/declaration_digest", "declaration_digest_drift",
      reference.declaration_digest)
  }
  const accepted = context.execution_trust.grants[reference.work_item]
  const executionDiagnostics = await validateExecutionAuthority(
    grant, context.execution_schema, {
      ...context.execution_context,
      baseRevision: accepted?.baseRevision ?? "",
      sourceDigest: accepted?.sourceDigest ?? "",
      externalAuthorities: accepted?.externalAuthorities ?? [],
    },
  )
  for (const item of executionDiagnostics) {
    report(item.field_path, item.code, item.target)
  }
  return diagnostics
}
