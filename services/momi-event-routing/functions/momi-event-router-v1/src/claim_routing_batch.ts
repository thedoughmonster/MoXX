import { sql } from "./database.ts"
import type { RoutingInput } from "./types.ts"

export function claimRoutingBatch(limit: number): Promise<RoutingInput[]> {
  return sql<RoutingInput[]>`
    select event_id::text, capability_token::text
    from momi_events.claim_routing_work(${limit}::integer)
  `
}
