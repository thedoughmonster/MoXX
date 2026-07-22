import { getDatabase } from "./database.ts"
import type { AssistantContext } from "./types.ts"

export async function loadAssistantContext(): Promise<AssistantContext> {
  const sql = getDatabase()
  const rows = await sql<AssistantContext[]>`
    select context_version, assistant_name, organization_name,
      organization_aliases, context_summary, primary_location_name,
      primary_timezone, scope.current_business_date::text,
      coalesce((select jsonb_agg(catalog order by catalog.relation_name)
        from momi_analysis.catalog_v1 as catalog), '[]'::jsonb) as analysis_catalog
    from momi_communications_gateway.assistant_context as context
    join momi_analysis.scopes_v1 as scope on scope.scope_key = 'primary'
    where context.singleton and context.enabled
  `
  if (!rows[0]) throw new Error("assistant_context_unavailable")
  return rows[0]
}
