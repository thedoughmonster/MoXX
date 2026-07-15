import { sql } from "./database.ts"
import { functionKey, type RoutingInput, type RoutingResult } from "./types.ts"

export async function executeRouting(input: RoutingInput): Promise<RoutingResult> {
  const claimed = await sql<{ claimed: boolean }[]>`
    select momi_events.claim_routing_work_item(
      ${input.event_id}::uuid,
      ${input.capability_token}::uuid
    ) as claimed
  `
  if (!claimed[0]?.claimed) {
    return { status: 202, body: { ok: true, function_key: functionKey,
      event_id: input.event_id, disposition: "duplicate" } }
  }
  try {
    const routed = await sql<{ delivery_count: number }[]>`
      select momi_events.route_event(
        ${input.event_id}::uuid,
        ${input.capability_token}::uuid
      )::integer as delivery_count
    `
    return { status: 200, body: { ok: true, function_key: functionKey,
      event_id: input.event_id, disposition: "routed",
      delivery_count: routed[0]?.delivery_count ?? 0 } }
  } catch (error) {
    const message = error instanceof Error ? error.message : "routing failed"
    await sql`select momi_events.fail_routing_work(
      ${input.event_id}::uuid, ${input.capability_token}::uuid, ${message}
    )`
    return { status: 503, body: { ok: false, function_key: functionKey,
      event_id: input.event_id, disposition: "retrying" } }
  }
}
