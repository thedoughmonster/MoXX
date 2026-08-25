import { sql } from "./database.ts"

export async function failRouting(
  eventId: string,
  capabilityToken: string,
  error: string,
): Promise<boolean> {
  const failed = await sql<{ failed: boolean }[]>`
    select momi_events.fail_routing_work(
      ${eventId}::uuid,
      ${capabilityToken}::uuid,
      ${error}
    ) as failed
  `
  return failed[0]?.failed ?? false
}
