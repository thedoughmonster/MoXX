import type { JSONValue } from "postgres"
import { getDatabase } from "./database.ts"

export async function completeInvocation(
  invocationId: string,
  status: "completed" | "failed" | "paid_ambiguous",
  receiptId: string | null,
  outputTokens: number,
  errorCode: string | null,
  terminalResponse: Record<string, JSONValue> | null,
): Promise<void> {
  const sql = getDatabase()
  const rows = await sql<{ completed: boolean }[]>`
    select momi_communications_gateway.complete_invocation_v2(
      ${invocationId}::uuid, ${status}, ${receiptId}::uuid,
      ${outputTokens}, ${errorCode},
      ${terminalResponse === null ? null : sql.json(terminalResponse)}
    ) as completed
  `
  if (!rows[0]?.completed) throw new Error("invocation_terminalization_failed")
}
