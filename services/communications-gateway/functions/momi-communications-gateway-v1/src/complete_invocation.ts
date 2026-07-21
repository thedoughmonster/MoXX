import { getDatabase } from "./database.ts"

export async function completeInvocation(
  invocationId: string,
  status: "completed" | "failed" | "paid_ambiguous",
  receiptId: string | null,
  outputTokens: number,
  billedMicros: string,
  errorCode: string | null,
): Promise<boolean> {
  const sql = getDatabase()
  const rows = await sql<{ completed: boolean }[]>`
    select momi_communications_gateway.complete_invocation_v1(
      ${invocationId}::uuid, ${status}, ${receiptId}::uuid,
      ${outputTokens}, ${billedMicros}::bigint, ${errorCode}
    ) as completed
  `
  return rows[0]?.completed ?? false
}
