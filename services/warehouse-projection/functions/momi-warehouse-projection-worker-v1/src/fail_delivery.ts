import { sql } from "./database.ts"
import { subscriptionKey } from "./types.ts"
import type { DeliveryFailure } from "./types.ts"

export async function failDelivery(
  eventId: string,
  messageId: string,
  capabilityToken: string,
  error: string,
): Promise<DeliveryFailure> {
  const rows = await sql<{ outcome: unknown }[]>`
    select momi_events.fail_delivery(
      ${subscriptionKey}, ${eventId}::uuid, ${messageId}::bigint,
      ${capabilityToken}::uuid, ${error}
    ) as outcome
  `
  const outcome = rows[0]?.outcome
  if (
    outcome !== "retry_wait" && outcome !== "dead_letter" &&
    outcome !== "not_found"
  ) throw new Error("delivery_failure_result_invalid")
  return outcome
}
