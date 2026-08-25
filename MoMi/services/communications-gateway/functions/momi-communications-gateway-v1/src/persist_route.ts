import { getDatabase } from "./database.ts"
import type { RouteSelection } from "./types.ts"

export async function persistRoute(invocationId: string, userId: string,
  route: RouteSelection): Promise<void> {
  const sql = getDatabase()
  const rows = await sql<{ selected: boolean }[]>`
    update momi_communications_gateway.invocations invocation set
      selected_route = profile.route_key, provider_model = profile.provider_model,
      reasoning_effort = profile.reasoning_effort, routing_source = ${route.source},
      routing_reason = ${route.reason}, routing_confidence = ${route.confidence},
      maximum_answer_calls = profile.maximum_answer_calls
    from momi_communications_gateway.user_limits limits,
      momi_communications_gateway.routing_profiles profile,
      momi_communications_gateway.routing_profiles ceiling
    where invocation.invocation_id = ${invocationId}::uuid
      and invocation.user_id = ${userId}::uuid and limits.user_id = invocation.user_id
      and profile.route_key = ${route.route_key} and profile.enabled
      and ceiling.route_key = limits.maximum_route
      and profile.route_rank <= ceiling.route_rank
    returning true as selected
  `
  if (!rows[0]?.selected) throw new Error("route_not_authorized")
}
