import { getDatabase } from "./database.ts"
import type { RouteKey, RouteProfile, RoutingPolicy } from "./types.ts"

export async function loadRoutingPolicy(userId: string): Promise<RoutingPolicy> {
  const sql = getDatabase()
  const policies = await sql<{ router_prompt_version: string;
    default_route: RouteKey; maximum_route: RouteKey }[]>`
    select policy.router_prompt_version, limits.default_route, limits.maximum_route
    from momi_communications_gateway.routing_policy policy
    join momi_communications_gateway.user_limits limits on limits.user_id = ${userId}::uuid
    where policy.singleton and policy.enabled
  `
  const profiles = await sql<RouteProfile[]>`
    select route_key, route_rank, maximum_output_tokens,
      maximum_answer_calls, automatic_enabled
    from momi_communications_gateway.routing_profiles
    where enabled order by route_rank
  `
  if (!policies[0] || !profiles.length) throw new Error("routing_policy_unavailable")
  return { ...policies[0], profiles }
}
