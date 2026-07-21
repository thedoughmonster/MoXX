import type { JSONValue } from "postgres"
import { getDatabase } from "./database.ts"
import type { ToolContext } from "./types.ts"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const kinds = new Set(["order", "payment", "menu", "schedule", "stock"])

export async function runCanonicalTool(
  value: unknown,
  context: ToolContext,
): Promise<JSONValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "invalid_tool_arguments" }
  }
  const args = value as Record<string, unknown>
  if (typeof args.query_kind !== "string" || !kinds.has(args.query_kind) ||
    typeof args.subject_entity_id !== "string" || !uuid.test(args.subject_entity_id) ||
    !(args.scope_entity_id === null || args.scope_entity_id === undefined ||
      typeof args.scope_entity_id === "string" && uuid.test(args.scope_entity_id)) ||
    (args.query_kind === "stock") !== (typeof args.scope_entity_id === "string")) {
    return { error: "invalid_tool_arguments" }
  }
  const sql = getDatabase()
  const issued = await sql<{ capability_id: string; capability_token: string }[]>`
    select capability_id::text, capability_token::text
    from momi_api.issue_beta_query_capability_v1(
      ${context.input.user.id}::uuid, ${context.invocationId}::uuid,
      ${args.query_kind}, ${args.subject_entity_id}::uuid,
      ${args.scope_entity_id ?? null}::uuid
    )
  `
  if (!issued[0]) return { error: "capability_issue_failed" }
  const rows = await sql<{ result: JSONValue }[]>`
    select momi_api.consume_beta_query_capability_v1(
      ${issued[0].capability_id}::uuid, ${issued[0].capability_token}::uuid,
      ${context.input.user.id}::uuid, ${context.invocationId}::uuid
    ) as result
  `
  return rows[0]?.result ?? { error: "canonical_record_not_found" }
}
