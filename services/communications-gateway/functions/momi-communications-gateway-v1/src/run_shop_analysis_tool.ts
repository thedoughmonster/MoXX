import type { JSONValue } from "postgres"
import { getDatabase } from "./database.ts"
import { validateAnalysisSql } from "./validate_analysis_sql.ts"

export async function runShopAnalysisTool(value: unknown): Promise<JSONValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "invalid_tool_arguments" }
  }
  const args = value as Record<string, unknown>
  if (Object.keys(args).length !== 1) return { error: "invalid_tool_arguments" }
  const sql = getDatabase()
  try {
    return await sql.begin("read only", async (transaction) => {
      const catalog = await transaction<{ relation_name: string }[]>`
        select relation_name from momi_analysis.catalog_v1
      `
      const settings = await transaction<{ primary_timezone: string }[]>`
        select primary_timezone
        from momi_communications_gateway.assistant_context
        where singleton and enabled
      `
      const query = validateAnalysisSql(args.sql,
        new Set(catalog.map((entry) => entry.relation_name.toLowerCase())))
      if (!query || !settings[0]) return { error: "analysis_query_rejected" }
      await transaction`
        select set_config('TimeZone', ${settings[0].primary_timezone}, true),
          set_config('statement_timeout', '6000', true),
          set_config('idle_in_transaction_session_timeout', '8000', true)
      `
      const rows = await transaction<{ result: JSONValue }[]>`
        select momi_analysis.execute_query_v1(${query}) as result
      `
      return rows[0]?.result ?? { error: "analysis_query_failed" }
    })
  } catch {
    return { error: "analysis_query_failed" }
  }
}
