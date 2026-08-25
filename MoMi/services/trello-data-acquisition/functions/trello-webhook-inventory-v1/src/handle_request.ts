import { processInventory } from "./process_inventory.ts"
import { inventoryDependencies } from "./runtime_dependencies.ts"

export function handleRequest(request: Request): Promise<Response> {
  return processInventory(request, inventoryDependencies)
}
