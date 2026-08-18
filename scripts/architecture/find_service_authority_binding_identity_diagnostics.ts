import { digestServiceAuthorityBinding } from
  "./digest_service_authority_binding.ts"
import type {
  ServiceAuthorityBinding,
  ServiceAuthorityBindingContext,
  ServiceAuthorityBindingDiagnostic,
} from "./service_authority_binding_types.ts"

export function findServiceAuthorityBindingIdentityDiagnostics(
  binding: ServiceAuthorityBinding,
  context: ServiceAuthorityBindingContext,
): ServiceAuthorityBindingDiagnostic[] {
  const diagnostics: ServiceAuthorityBindingDiagnostic[] = []
  const report = (json_pointer: string, code: string, target: string) => {
    diagnostics.push({ service: binding.service, layer: "binding",
      source_path: "", json_pointer, code, target,
      message: `${code}: ${target}` })
  }
  if (binding.repository !== context.repository) {
    report("/repository", "repository_mismatch", binding.repository)
  }
  if (binding.revision !== context.revision) {
    report("/revision", "revision_drift", binding.revision)
  }
  const digest = digestServiceAuthorityBinding(binding)
  if (binding.binding_digest !== digest) {
    report("/binding_digest", "binding_digest_drift", binding.binding_digest)
  }
  return diagnostics
}
