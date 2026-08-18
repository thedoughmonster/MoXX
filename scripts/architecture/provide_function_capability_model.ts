import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { compareUtf16 } from "./compare_utf16.ts"
import { collectFunctionTransitiveEffects } from
  "./collect_function_transitive_effects.ts"
import { digestFunctionCapabilityModel } from
  "./digest_function_capability_model.ts"
import { findFunctionCapabilityModelDiagnostics } from
  "./find_function_capability_model_diagnostics.ts"
import { findFunctionCapabilityProjectionDiagnostics } from
  "./find_function_capability_projection_diagnostics.ts"
import { findFunctionCapabilitySourceDiagnostics } from
  "./find_function_capability_source_diagnostics.ts"
import {
  functionCapabilityModelSchemaId,
  type DirectFunctionCapability,
  type FunctionCapabilityModel,
  type FunctionCapabilityModelResult,
} from "./function_capability_model_types.ts"
import { functionCapabilityModelSchemaPath } from "./paths.ts"
import { readJson } from "./read_json.ts"
import { sortFunctionCapabilityDiagnostics } from
  "./sort_function_capability_diagnostics.ts"
import type { Architecture } from "./types.ts"
import { validateJson } from "./validate_json.ts"
import type { ArchitectureSnapshot } from
  "./architecture_snapshot_identity_types.ts"

export async function provideFunctionCapabilityModel(
  architecture: Pick<Architecture, "services" | "functions">,
  sourceSnapshot: ArchitectureSnapshot,
  expectedSourceSnapshot: ArchitectureSnapshot,
): Promise<FunctionCapabilityModelResult> {
  const diagnostics = [
    ...findFunctionCapabilityModelDiagnostics(architecture),
    ...await findFunctionCapabilitySourceDiagnostics(
      sourceSnapshot, expectedSourceSnapshot,
    ),
  ]
  const sortedDiagnostics = sortFunctionCapabilityDiagnostics(diagnostics)
  if (sortedDiagnostics.some((item) =>
    item.code !== "capability_model_absent")) {
    return { diagnostics: sortedDiagnostics }
  }
  const services = new Map(architecture.services.map((service) =>
    [service.manifest.service_key, service]))
  const functions = architecture.functions.filter((loaded) =>
    loaded.manifest.capability_model).map((loaded) => {
      const manifest = loaded.manifest
      const called = [...manifest.capability_model!.called_contracts].sort(
        (a, b) => compareUtf16(canonicalJson(a), canonicalJson(b)),
      )
      return {
        function_key: manifest.function_key,
        owner_service: manifest.owner_service,
        manifest_path:
          `services/${manifest.owner_service}/functions/${loaded.slug}/function.json`,
        direct_capabilities: [...manifest.required_capabilities].sort(
          compareUtf16,
        ) as DirectFunctionCapability[],
        called_contracts: called,
        transitive_effects: collectFunctionTransitiveEffects(
          manifest.owner_service, called, services,
        ),
      }
    }).sort((a, b) => compareUtf16(a.function_key, b.function_key))
  const payload = {
    $schema: functionCapabilityModelSchemaId,
    schema_version: 1 as const,
    source_snapshot: sourceSnapshot,
    functions,
  }
  const projection: FunctionCapabilityModel = {
    ...payload,
    digest: digestFunctionCapabilityModel(payload),
  }
  const semantic = findFunctionCapabilityProjectionDiagnostics(projection)
  if (semantic.length > 0) return {
    diagnostics: sortFunctionCapabilityDiagnostics([
      ...sortedDiagnostics, ...semantic,
    ]),
  }
  const schema = await readJson<object>(functionCapabilityModelSchemaPath)
  validateJson(schema, projection, "function capability model")
  return { projection, diagnostics: sortedDiagnostics }
}
