import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { compareUtf16 } from "./compare_utf16.ts"
import type { ServiceDependencyGraphDiagnostic } from
  "./service_dependency_graph_types.ts"

export function sortServiceDependencyDiagnostics(
  diagnostics: ServiceDependencyGraphDiagnostic[],
): ServiceDependencyGraphDiagnostic[] {
  return diagnostics.sort((left, right) => compareUtf16(canonicalJson([
    left.field_path, left.code, left.expected, left.actual,
  ]), canonicalJson([
    right.field_path, right.code, right.expected, right.actual,
  ])))
}
