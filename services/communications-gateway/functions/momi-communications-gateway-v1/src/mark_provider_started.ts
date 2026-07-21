import { getDatabase } from "./database.ts"

export async function authorizeProviderRound(
  invocationId: string,
  payloadTokens: number,
  round: 1 | 2,
): Promise<boolean> {
  const sql = getDatabase()
  const rows = await sql<{ marked: boolean }[]>`
    select momi_communications_gateway.mark_provider_started_v1(
      ${invocationId}::uuid, ${payloadTokens}, ${round}
    ) as marked
  `
  return rows[0]?.marked ?? false
}
