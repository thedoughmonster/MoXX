import { sql } from "./database.ts"

export async function routeEvent(
  eventId: string,
  capabilityToken: string,
): Promise<number> {
  const routed = await sql<{ delivery_count: number }[]>`
    select momi_events.route_event(
      ${eventId}::uuid,
      ${capabilityToken}::uuid
    )::integer as delivery_count
  `
  return routed[0]?.delivery_count ?? 0
}
