import { getDatabase } from "./database.ts"

export async function authorizeProviderRound(
  invocationId: string,
  payloadTokens: number,
  round: number,
): Promise<boolean> {
  const sql = getDatabase()
  const rows = await sql<{ marked: boolean }[]>`
    select momi_communications_gateway.authorize_provider_attempt_v2(
      ${invocationId}::uuid, ${payloadTokens}, ${round}
    ) as marked
  `
  return rows[0]?.marked ?? false
}
