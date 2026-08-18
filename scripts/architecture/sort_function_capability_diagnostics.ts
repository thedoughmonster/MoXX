import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { compareUtf16 } from "./compare_utf16.ts"
import type { FunctionCapabilityDiagnostic } from
  "./function_capability_model_types.ts"

export function sortFunctionCapabilityDiagnostics(
  diagnostics: FunctionCapabilityDiagnostic[],
): FunctionCapabilityDiagnostic[] {
  return diagnostics.sort((left, right) =>
    compareUtf16(left.function_key, right.function_key) ||
    compareUtf16(left.field_path, right.field_path) ||
    compareUtf16(left.code, right.code) ||
    compareUtf16(left.target, right.target) ||
    compareUtf16(canonicalJson(left.provenance), canonicalJson(right.provenance))
  )
}
