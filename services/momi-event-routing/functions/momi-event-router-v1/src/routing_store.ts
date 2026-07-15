import { claimRoutingBatch } from "./claim_routing_batch.ts"
import { claimRoutingItem } from "./claim_routing_item.ts"
import { failRouting } from "./fail_routing.ts"
import { routeEvent } from "./route_event.ts"
import type { RoutingStore } from "./types.ts"

export const routingStore: RoutingStore = {
  claimItem: claimRoutingItem,
  claimBatch: claimRoutingBatch,
  routeEvent,
  failRouting,
}
