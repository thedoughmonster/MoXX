import { processDelivery } from "./process_delivery.ts"
import { deliveryDependencies } from "./runtime_dependencies.ts"

export function handleRequest(request: Request): Promise<Response> {
  return processDelivery(request, deliveryDependencies)
}
