import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { compareUtf16 } from "./compare_utf16.ts"
import type { FunctionCapabilityDiagnostic } from
  "./function_capability_model_types.ts"
import { sortFunctionCapabilityDiagnostics } from
  "./sort_function_capability_diagnostics.ts"

export function inspectRawFunctionCapabilityModel(
  value: unknown,
  manifestPath: string,
): FunctionCapabilityDiagnostic[] {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
  const functionKey = typeof record.function_key === "string"
    ? record.function_key : manifestPath
  const provenance = [manifestPath]
  const model = record.capability_model
  if (model === undefined) return [{
    function_key: functionKey,
    field_path: "/capability_model",
    code: "capability_model_absent",
    target: functionKey,
    provenance,
  }]
  if (!model || typeof model !== "object" || Array.isArray(model)) return [{
    function_key: functionKey,
    field_path: "/capability_model",
    code: "capability_model_shape_invalid",
    target: canonicalJson(model),
    provenance,
  }]
  const capability = model as Record<string, unknown>
  const diagnostics: FunctionCapabilityDiagnostic[] = []
  if (canonicalJson(Object.keys(capability).sort(compareUtf16)) !==
    canonicalJson(["called_contracts", "schema_version"])) diagnostics.push({
      function_key: functionKey,
      field_path: "/capability_model",
      code: "capability_model_shape_invalid",
      target: canonicalJson(Object.keys(capability).sort(compareUtf16)),
      provenance,
    })
  if (capability.schema_version !== 1) diagnostics.push({
    function_key: functionKey,
    field_path: "/capability_model/schema_version",
    code: "unsupported_capability_model_version",
    target: canonicalJson(capability.schema_version),
    provenance,
  })
  if (!Array.isArray(capability.called_contracts)) {
    diagnostics.push({
      function_key: functionKey,
      field_path: "/capability_model/called_contracts",
      code: "capability_model_shape_invalid",
      target: canonicalJson(capability.called_contracts),
      provenance,
    })
    return sortFunctionCapabilityDiagnostics(diagnostics)
  }
  const identities: string[] = []
  for (const [index, item] of capability.called_contracts.entries()) {
    const tuple = item && typeof item === "object" && !Array.isArray(item)
      ? item as Record<string, unknown> : {}
    const valid = canonicalJson(Object.keys(tuple).sort(compareUtf16)) ===
        canonicalJson(["contract", "service"]) &&
      typeof tuple.service === "string" &&
      /^[a-z][a-z0-9-]+$/.test(tuple.service) &&
      typeof tuple.contract === "string" &&
      /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*\.v[1-9][0-9]*$/.test(
        tuple.contract,
      )
    if (!valid) diagnostics.push({
      function_key: functionKey,
      field_path: `/capability_model/called_contracts/${index}`,
      code: "capability_model_shape_invalid",
      target: canonicalJson(item),
      provenance,
    })
    else identities.push(canonicalJson({
      service: tuple.service, contract: tuple.contract,
    }))
  }
  const seen = new Set<string>()
  for (const [index, identity] of identities.entries()) {
    if (seen.has(identity)) diagnostics.push({
      function_key: functionKey,
      field_path: `/capability_model/called_contracts/${index}`,
      code: "duplicate_called_contract",
      target: identity,
      provenance,
    })
    seen.add(identity)
  }
  const sorted = [...identities].sort(compareUtf16)
  if (canonicalJson(identities) !== canonicalJson(sorted)) diagnostics.push({
    function_key: functionKey,
    field_path: "/capability_model/called_contracts",
    code: "called_contracts_unsorted",
    target: canonicalJson(identities),
    provenance,
  })
  return sortFunctionCapabilityDiagnostics(diagnostics)
}
