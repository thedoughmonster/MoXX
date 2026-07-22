import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { assistantInstructions } from "../src/assistant_instructions.ts"
import { hashRequest } from "../src/hash_request.ts"
import type { AssistantContext, ChatInput } from "../src/types.ts"

const migration = new URL(
  "../../../../../supabase/migrations/20260722135631_add_gateway_assistant_context_mapping.sql",
  import.meta.url,
)
const builder = new URL("../src/assistant_instructions.ts", import.meta.url)
const analysisMigration = new URL(
  "../../../../../supabase/migrations/20260722152443_add_curated_shop_analysis_query_contract.sql",
  import.meta.url,
)
const context: AssistantContext = {
  context_version: "momi-context-v3",
  assistant_name: "MoMi",
  organization_name: "Dough Monster",
  organization_aliases: ["Dough Monster", "DoughMonster"],
  context_summary: "Mapped business context.",
  primary_location_name: "Berwick",
  primary_timezone: "America/New_York",
  current_business_date: "2026-07-22",
  analysis_catalog: [{ relation_name: "orders_v1",
    description: "Orders without customer identity.",
    columns: ["business_date:date", "total_amount:numeric"] }],
}
test("builds provider instructions from mapped business context", () => {
  const result = assistantInstructions(context)
  assert.match(result, /Dough Monster/u)
  assert.match(result, /Berwick/u)
  assert.match(result, /2026-07-22/u)
  assert.match(result, /orders_v1\(business_date:date, total_amount:numeric\)/u)
  assert.match(result, /query_momi_shop_data/u)
  assert.match(result, /Never ask a user for an internal UUID/u)
  assert.match(result, /Ask at most one natural clarification/u)
})

test("stores configurable business identity in the owned database mapping", async () => {
  const sql = await readFile(migration, "utf8")
  const analysisSql = await readFile(analysisMigration, "utf8")
  const source = await readFile(builder, "utf8")
  assert.match(sql, /create table momi_communications_gateway\.assistant_context/u)
  assert.match(sql, /'Dough Monster'/u)
  assert.match(sql, /enable row level security/u)
  assert.match(sql, /grant select .*assistant_context to service_role/su)
  assert.match(analysisSql, /beta_analysis_catalog/u)
  assert.match(analysisSql, /beta_analysis_scopes/u)
  assert.doesNotMatch(source, /Dough Monster|doughmonster\.com|[0-9a-f]{8}-[0-9a-f-]{27,}/iu)
})

test("binds mapped instructions into invocation idempotency", async () => {
  const input = { model: "momi-assistant", messages: [{ role: "user", content: "Hi" }],
    user: { id: "c03fbd6e-65b7-4b23-8e65-2e5a8ec00123", email: "user@example.com" },
    conversation_id: "conversation-1", turn_id: "turn-1",
    idempotency_key: "conversation-1:turn-1" } as ChatInput
  assert.notEqual(await hashRequest(input, "context one"),
    await hashRequest(input, "context two"))
})
