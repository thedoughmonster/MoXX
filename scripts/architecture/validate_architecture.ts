import { join } from "node:path"

import type { Architecture } from "./types.ts"
import { workspaceRoot } from "./paths.ts"
import { loadWorkspace } from "./load_workspace.ts"
import { discoverServices } from "./discover_services.ts"
import { loadFunctions } from "./load_functions.ts"
import { loadSourceModules } from "./load_source_modules.ts"
import { findServiceGraphViolations } from "./find_service_graph_violations.ts"
import { findImportBoundaryViolations } from "./find_import_boundary_violations.ts"
import { findAuthorityViolations } from "./find_authority_violations.ts"
import { findDependencyViolations } from "./find_dependency_violations.ts"
import { findAdapterViolations } from "./find_adapter_violations.ts"
import { findAdrNumberViolations } from "./find_adr_number_violations.ts"
import { findExecutionAuthorityViolations } from
  "./find_execution_authority_violations.ts"
import { findServiceAuthorityBindingViolations } from
  "./find_service_authority_binding_violations.ts"
import { loadRetirements } from "./load_retirements.ts"
import { findFunctionInventoryViolations } from
  "./find_function_inventory_violations.ts"
import { findServiceStatusViolations } from
  "./find_service_status_violations.ts"
import { findServiceTestImpactDiagnostics } from
  "./find_service_test_impact_diagnostics.ts"
import { findFunctionCapabilityModelDiagnostics } from
  "./find_function_capability_model_diagnostics.ts"

export async function validateArchitecture(): Promise<Architecture> {
  const workspace = await loadWorkspace()
  const services = await discoverServices(workspace.paths.services)
  const testImpactViolations = (await findServiceTestImpactDiagnostics(
    services, workspaceRoot,
  )).filter((item) => item.code !== "metadata_absent")
  if (testImpactViolations.length > 0) {
    throw new Error(
      `Architecture violations:\n- ${testImpactViolations.map((item) =>
        JSON.stringify(item)).join("\n- ")}`,
    )
  }
  const statusViolations = findServiceStatusViolations(services)
  if (statusViolations.length > 0) {
    throw new Error(
      `Architecture violations:\n- ${statusViolations.join("\n- ")}`,
    )
  }
  const retirements = await loadRetirements(workspace.paths.retirements, services)
  const inventoryViolations = await findFunctionInventoryViolations(
    workspace,
    services,
  )
  if (inventoryViolations.length > 0) {
    throw new Error(
      `Architecture violations:\n- ${inventoryViolations.join("\n- ")}`,
    )
  }
  const functions = await loadFunctions(workspace, services)
  const capabilityViolations = findFunctionCapabilityModelDiagnostics({
    services, functions,
  }).filter((item) => item.code !== "capability_model_absent")
  if (capabilityViolations.length > 0) {
    throw new Error(
      `Architecture violations:\n- ${capabilityViolations.map((item) =>
        JSON.stringify(item)).join("\n- ")}`,
    )
  }
  const modules = await loadSourceModules(services)
  const violations = [
    ...await findExecutionAuthorityViolations(services),
    ...await findServiceAuthorityBindingViolations(services),
    ...await findAdrNumberViolations(
      join(workspaceRoot, "docs", "decisions"),
    ),
    ...findServiceGraphViolations(services),
    ...findImportBoundaryViolations(modules, services),
    ...findAuthorityViolations(workspace, services, modules),
    ...await findDependencyViolations(functions),
    ...await findAdapterViolations(workspace, functions),
  ]

  if (violations.length > 0) {
    throw new Error(`Architecture violations:\n- ${violations.join("\n- ")}`)
  }

  return { workspace, services, functions, modules, retirements }
}
