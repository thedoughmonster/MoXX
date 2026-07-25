import type { JSONValue } from "postgres"
import type { AsyncRound } from "./async_round.ts"
import { getDatabase } from "./database.ts"

export async function finishAsyncRound(current: AsyncRound, value: {
  status: "completed" | "failed" | "paid_ambiguous"
  terminal_receipt: string
  output_tokens: number
  error_code: string | null
  terminal_response: Record<string, JSONValue> | null
  visible_content: string
}): Promise<void> {
  const sql = getDatabase()
  const rows = await sql<{ finished: boolean }[]>`
    select momi_communications_gateway.finish_async_round_v1(
      ${current.async_round_id}::uuid, ${current.lease_token}::uuid,
      ${value.status}, ${value.terminal_receipt}::uuid, ${value.output_tokens},
      ${value.error_code},
      ${value.terminal_response === null ? null : sql.json(value.terminal_response)},
      ${value.visible_content}
    ) as finished
  `
  if (!rows[0]?.finished) throw new Error("async_round_finish_failed")
}
