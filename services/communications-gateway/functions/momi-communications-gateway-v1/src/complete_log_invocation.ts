import type { JSONValue } from "postgres"
import { getDatabase } from "./database.ts"

export async function completeLogInvocation(
  invocationId: string,
  receiptId: string,
  response: Record<string, JSONValue>,
): Promise<void> {
  const sql = getDatabase()
  const rows = await sql<{ completed: boolean }[]>`
    select momi_communications_gateway.complete_log_invocation_v1(
      ${invocationId}::uuid, ${receiptId}::uuid, ${sql.json(response)}
    ) as completed
  `
  if (!rows[0]?.completed) throw new Error("log_terminalization_failed")
}
