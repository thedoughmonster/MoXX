import { getDatabase } from "./database.ts"

export async function markArchiveAdmitted(
  invocationId: string,
  receiptId: string,
): Promise<boolean> {
  const sql = getDatabase()
  const rows = await sql<{ marked: boolean }[]>`
    select momi_communications_gateway.mark_archive_admitted_v1(
      ${invocationId}::uuid, ${receiptId}::uuid
    ) as marked
  `
  return rows[0]?.marked ?? false
}
