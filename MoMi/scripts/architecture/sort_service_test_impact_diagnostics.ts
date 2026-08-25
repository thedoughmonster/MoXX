import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { compareUtf16 } from "./compare_utf16.ts"
import type { ServiceTestImpactDiagnostic } from
  "./service_test_impact_types.ts"

export function sortServiceTestImpactDiagnostics(
  diagnostics: ServiceTestImpactDiagnostic[],
): ServiceTestImpactDiagnostic[] {
  return diagnostics.sort((left, right) => compareUtf16(canonicalJson([
    left.source, left.selector_id ?? "", left.field, left.code, left.target,
  ]), canonicalJson([
    right.source, right.selector_id ?? "", right.field, right.code,
    right.target,
  ])))
}
