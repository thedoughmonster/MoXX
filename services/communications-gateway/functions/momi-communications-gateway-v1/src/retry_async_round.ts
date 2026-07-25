import type { AsyncRound } from "./async_round.ts"
import { getDatabase } from "./database.ts"

export async function retryAsyncRound(current: AsyncRound,
  errorCode: string): Promise<void> {
  const sql = getDatabase()
  const rows = await sql<{ retried: boolean }[]>`
    select momi_communications_gateway.retry_async_round_v1(
      ${current.async_round_id}::uuid, ${current.lease_token}::uuid, ${errorCode}
    ) as retried
  `
  if (!rows[0]?.retried) throw new Error("async_round_retry_failed")
}
