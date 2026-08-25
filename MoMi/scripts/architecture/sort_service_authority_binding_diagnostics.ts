import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { compareUtf16 } from "./compare_utf16.ts"
import type { ServiceAuthorityBindingDiagnostic } from
  "./service_authority_binding_types.ts"

export function sortServiceAuthorityBindingDiagnostics(
  diagnostics: ServiceAuthorityBindingDiagnostic[],
): ServiceAuthorityBindingDiagnostic[] {
  return diagnostics.sort((left, right) => compareUtf16(canonicalJson([
    left.service, left.layer, left.source_path, left.json_pointer,
    left.code, left.target,
  ]), canonicalJson([
    right.service, right.layer, right.source_path, right.json_pointer,
    right.code, right.target,
  ])))
}
