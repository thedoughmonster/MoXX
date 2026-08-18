import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { compareUtf16 } from "./compare_utf16.ts"
import type {
  FunctionCapabilityDiagnostic,
  FunctionCapabilityModel,
  FunctionGrantBoundaryContext,
} from "./function_capability_model_types.ts"
import { sortFunctionCapabilityDiagnostics } from
  "./sort_function_capability_diagnostics.ts"

export function validateFunctionCapabilityGrantBoundary(
  model: FunctionCapabilityModel,
  context: FunctionGrantBoundaryContext,
): FunctionCapabilityDiagnostic[] {
  const diagnostics: FunctionCapabilityDiagnostic[] = []
  const selected = context.function_key
  const key = typeof selected === "string" ? selected : selected[0] ?? ""
  if ((typeof selected === "string" && selected.length === 0) ||
    (Array.isArray(selected) && selected.length === 0)) diagnostics.push({
      function_key: key || "<missing>", field_path: "/function_key",
      code: "function_selection_missing", target: canonicalJson(selected),
      provenance: [model.digest],
    })
  if (Array.isArray(selected) && selected.length > 1) diagnostics.push({
    function_key: key || "<multiple>", field_path: "/function_key",
    code: "multiple_function_scope", target: canonicalJson(selected),
    provenance: [model.digest],
  })
  const matches = model.functions.filter((item) => item.function_key === key)
  if (matches.length > 1) diagnostics.push({
    function_key: key,
    field_path: "/function_key",
    code: "duplicate_function_key",
    target: key,
    provenance: matches.map((item) => item.manifest_path).sort(compareUtf16),
  })
  const fn = matches.length === 1 ? matches[0] : undefined
  if (!fn && diagnostics.length === 0) diagnostics.push({
    function_key: key, field_path: "/function_key",
    code: "function_selection_missing", target: key,
    provenance: [model.digest],
  })
  if (!fn) return sortFunctionCapabilityDiagnostics(diagnostics)
  const grant = context.execution_authority
  const addUnmapped = (field_path: string, target: unknown) => diagnostics.push({
    function_key: key, field_path, code: "positive_namespace_unmapped",
    target: canonicalJson(target), provenance: [model.digest, fn.manifest_path],
  })
  if (grant.service !== fn.owner_service) addUnmapped(
    "/execution_authority/service", grant.service,
  )
  for (const [index, entry] of grant.database.read.entries()) {
    if (!fn.direct_capabilities.includes("database_read") ||
      entry.owner_service !== fn.owner_service) addUnmapped(
        `/execution_authority/database/read/${index}`, entry,
      )
  }
  for (const [index, entry] of grant.database.write.entries()) {
    if (!fn.direct_capabilities.includes("database_write") ||
      entry.owner_service !== fn.owner_service) addUnmapped(
        `/execution_authority/database/write/${index}`, entry,
      )
  }
  for (const [index, entry] of grant.contracts.call.entries()) {
    if (!fn.called_contracts.some((called) =>
      called.service === entry.provider_service &&
      called.contract === entry.contract)) addUnmapped(
        `/execution_authority/contracts/call/${index}`, entry,
      )
  }
  const unsupported: Array<[string, unknown[]]> = [
    ["filesystem/read", grant.filesystem.read],
    ["filesystem/write", grant.filesystem.write],
    ["network/connect", grant.network.connect],
    ["secrets/reference", grant.secrets.reference],
    ["packages/use", grant.packages.use],
    ["external/invoke", grant.external.invoke],
  ]
  for (const [field, entries] of unsupported) {
    for (const [index, entry] of entries.entries()) addUnmapped(
      `/execution_authority/${field}/${index}`, entry,
    )
  }
  return sortFunctionCapabilityDiagnostics(diagnostics)
}
