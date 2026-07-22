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
      per_attempt_cost_micros = ceil(
        (invocation.input_tokens * profile.input_micros_per_token) +
        (least(limits.maximum_output_tokens, profile.maximum_output_tokens) *
          profile.output_micros_per_token)
      )::bigint,
      reserved_micros = ceil(
        (invocation.input_tokens * profile.input_micros_per_token) +
        (least(limits.maximum_output_tokens, profile.maximum_output_tokens) *
          profile.output_micros_per_token)
      )::bigint * case when invocation.requested_route = 'auto' then 3 else 2 end
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
