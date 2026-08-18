import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { compareUtf16 } from "./compare_utf16.ts"
import type {
  FunctionCapabilityDiagnostic,
  FunctionCapabilityModel,
} from "./function_capability_model_types.ts"
import { sortFunctionCapabilityDiagnostics } from
  "./sort_function_capability_diagnostics.ts"

export function findFunctionCapabilityProjectionDiagnostics(
  model: FunctionCapabilityModel,
): FunctionCapabilityDiagnostic[] {
  const diagnostics: FunctionCapabilityDiagnostic[] = []
  const pathsByKey = new Map<string, string[]>()
  for (const fn of model.functions) {
    pathsByKey.set(fn.function_key, [
      ...(pathsByKey.get(fn.function_key) ?? []), fn.manifest_path,
    ])
  }
  for (const [key, paths] of pathsByKey) {
    if (paths.length < 2) continue
    diagnostics.push({
      function_key: key,
      field_path: "/function_key",
      code: "duplicate_function_key",
      target: key,
      provenance: paths.sort(compareUtf16),
    })
  }
  for (const fn of model.functions) {
    for (const [effectIndex, effect] of fn.transitive_effects.entries()) {
      const field = `/functions/${fn.function_key}/transitive_effects/${effectIndex}`
      if (!effect.source_path || !effect.source_pointer) diagnostics.push({
        function_key: fn.function_key,
        field_path: field,
        code: "effect_source_missing",
        target: canonicalJson([effect.source_path, effect.source_pointer]),
        provenance: [fn.manifest_path],
      })
      if (effect.provenance_paths.length === 0) diagnostics.push({
        function_key: fn.function_key,
        field_path: `${field}/provenance_paths`,
        code: "provenance_missing",
        target: effect.target,
        provenance: [fn.manifest_path, effect.source_path],
      })
      for (const [pathIndex, path] of effect.provenance_paths.entries()) {
        let expectedConsumer = fn.owner_service
        let valid = path.length > 0
        for (const edge of path) {
          valid = valid && edge.consumer === expectedConsumer
          expectedConsumer = edge.provider
        }
        valid = valid && expectedConsumer === effect.provider_service
        if (!valid) diagnostics.push({
          function_key: fn.function_key,
          field_path: `${field}/provenance_paths/${pathIndex}`,
          code: "provenance_missing",
          target: canonicalJson(path),
          provenance: [fn.manifest_path, effect.source_path],
        })
      }
    }
  }
  return sortFunctionCapabilityDiagnostics(diagnostics)
}
