import { sql } from "./database.ts"
import type { ClaimedWork } from "./types.ts"

export async function revokeOrderReadCapability(
  job: ClaimedWork,
  readWorkId: string,
): Promise<void> {
  const rows = await sql<Array<{ revoked: boolean }>>`
    select momi_alerting.revoke_order_read_capability(
      ${job.work_id}::bigint,
      ${job.attempt_id}::bigint,
      ${readWorkId}::bigint
    ) as revoked
  `
  if (rows[0]?.revoked !== true) {
    throw new Error("Canonical read capability was not revoked")
  }
}
