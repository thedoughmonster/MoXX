import { getDatabase } from "./database.ts"

export async function failInvocation(
  invocationId: string,
  receiptId: string,
  errorCode: string,
): Promise<boolean> {
  const sql = getDatabase()
  const rows = await sql<{ failed: boolean }[]>`
    select momi_communications_gateway.fail_invocation_v1(
      ${invocationId}::uuid, ${receiptId}::uuid, ${errorCode}
    ) as failed
  `
  return rows[0]?.failed ?? false
}
