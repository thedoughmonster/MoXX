import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { compareUtf16 } from "./compare_utf16.ts"
import { findServiceDependencySourceDiagnostics } from
  "./find_service_dependency_source_diagnostics.ts"
import type { Architecture } from "./types.ts"
import type { FunctionCapabilityDiagnostic } from
  "./function_capability_model_types.ts"
import { sortFunctionCapabilityDiagnostics } from
  "./sort_function_capability_diagnostics.ts"

export function findFunctionCapabilityModelDiagnostics(
  architecture: Pick<Architecture, "services" | "functions">,
): FunctionCapabilityDiagnostic[] {
  const diagnostics: FunctionCapabilityDiagnostic[] = []
  const services = new Map(architecture.services.map((service) =>
    [service.manifest.service_key, service]))
  const functionPaths = new Map<string, string[]>()
  for (const loaded of architecture.functions) {
    const key = loaded.manifest.function_key
    const path =
      `services/${loaded.manifest.owner_service}/functions/${loaded.slug}/function.json`
    functionPaths.set(key, [...(functionPaths.get(key) ?? []), path])
  }
  for (const [key, paths] of functionPaths) {
    if (paths.length < 2) continue
    diagnostics.push({
      function_key: key,
      field_path: "/function_key",
      code: "duplicate_function_key",
      target: key,
      provenance: paths.sort(compareUtf16),
    })
  }
  for (const graph of findServiceDependencySourceDiagnostics(
    architecture.services,
  )) {
    diagnostics.push({
      function_key: "<repository>",
      field_path: graph.field_path,
      code: graph.code === "cycle_detected"
        ? "dependency_cycle" : "called_contract_unknown",
      target: canonicalJson(graph.actual),
      provenance: ["service-dependency-graph/v2", graph.code],
    })
  }
  const transitiveLooking = new Set([
    "external_api", "external_invoke", "model_inference", "network_connect",
    "packages_use", "runtime_dependency", "secrets_reference",
  ])
  for (const loaded of architecture.functions) {
    const manifest = loaded.manifest
    const path = `services/${manifest.owner_service}/functions/${loaded.slug}/function.json`
    const model = manifest.capability_model
    if (!model) {
      diagnostics.push({
        function_key: manifest.function_key,
        field_path: "/capability_model",
        code: "capability_model_absent",
        target: manifest.function_key,
        provenance: [path],
      })
      continue
    }
    for (const [index, capability] of manifest.required_capabilities.entries()) {
      if (capability !== "database_read" && capability !== "database_write") {
        diagnostics.push({
          function_key: manifest.function_key,
          field_path: `/required_capabilities/${index}`,
          code: "unsupported_direct_capability",
          target: capability,
          provenance: [path],
        })
      }
      if (transitiveLooking.has(capability)) diagnostics.push({
        function_key: manifest.function_key,
        field_path: `/required_capabilities/${index}`,
        code: "direct_transitive_conflation",
        target: capability,
        provenance: [path],
      })
    }
    for (const [index, called] of model.called_contracts.entries()) {
      const consumed = loaded.service.manifest.contracts.consumes.some(
        (item) => item.service === called.service &&
          item.contract === called.contract,
      )
      if (!consumed) diagnostics.push({
        function_key: manifest.function_key,
        field_path: `/capability_model/called_contracts/${index}`,
        code: "called_contract_not_consumed",
        target: canonicalJson(called),
        provenance: [path, `services/${manifest.owner_service}/service.json`],
      })
      const provider = services.get(called.service)
      if (!provider?.manifest.contracts.provides.includes(called.contract)) {
        diagnostics.push({
          function_key: manifest.function_key,
          field_path: `/capability_model/called_contracts/${index}`,
          code: "called_contract_unknown",
          target: canonicalJson(called),
          provenance: [path, `services/${called.service}/service.json`],
        })
      }
    }
  }
  return sortFunctionCapabilityDiagnostics(diagnostics)
}
