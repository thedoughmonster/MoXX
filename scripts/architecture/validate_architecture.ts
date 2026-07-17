import type { Architecture } from "./types.ts"
import { loadWorkspace } from "./load_workspace.ts"
import { discoverServices } from "./discover_services.ts"
import { loadFunctions } from "./load_functions.ts"
import { loadSourceModules } from "./load_source_modules.ts"
import { findServiceGraphViolations } from "./find_service_graph_violations.ts"
import { findImportBoundaryViolations } from "./find_import_boundary_violations.ts"
import { findAuthorityViolations } from "./find_authority_violations.ts"
import { findDependencyViolations } from "./find_dependency_violations.ts"
import { findAdapterViolations } from "./find_adapter_violations.ts"
import { loadRetirements } from "./load_retirements.ts"
import { findFunctionInventoryViolations } from
  "./find_function_inventory_violations.ts"

export async function validateArchitecture(): Promise<Architecture> {
  const workspace = await loadWorkspace()
  const services = await discoverServices(workspace.paths.services)
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
  const modules = await loadSourceModules(functions)
  const violations = [
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
