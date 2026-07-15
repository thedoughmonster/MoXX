import { processRouting } from "./process_routing.ts"
import { routingStore } from "./routing_store.ts"
import type { RoutingInput, RoutingResult } from "./types.ts"

export function executeRouting(input: RoutingInput): Promise<RoutingResult> {
  return processRouting(input, routingStore)
}
