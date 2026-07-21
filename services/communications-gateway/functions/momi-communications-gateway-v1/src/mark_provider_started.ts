import { getDatabase } from "./database.ts"

export async function markProviderStarted(invocationId: string): Promise<boolean> {
  const sql = getDatabase()
  const rows = await sql<{ marked: boolean }[]>`
    select momi_communications_gateway.mark_provider_started_v1(
      ${invocationId}::uuid
    ) as marked
  `
  return rows[0]?.marked ?? false
}
