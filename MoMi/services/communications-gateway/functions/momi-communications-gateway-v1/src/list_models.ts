import { getDatabase } from "./database.ts"

export async function listModels(): Promise<Record<string, unknown>> {
  const sql = getDatabase()
  const rows = await sql<{ model_alias: string }[]>`
    select model_alias from momi_communications_gateway.list_models_v1()
  `
  return { object: "list", data: rows.map((row) => ({ id: row.model_alias,
    object: "model", owned_by: "momi" })) }
}
