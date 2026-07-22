import { getDatabase } from "./database.ts"
import type { AssistantContext } from "./types.ts"

export async function loadAssistantContext(): Promise<AssistantContext> {
  const sql = getDatabase()
  const rows = await sql<AssistantContext[]>`
    select context_version, assistant_name, organization_name,
      organization_aliases, context_summary
    from momi_communications_gateway.assistant_context
    where singleton and enabled
  `
  if (!rows[0]) throw new Error("assistant_context_unavailable")
  return rows[0]
}
