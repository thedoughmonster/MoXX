import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migration = new URL(
  "../../../../../supabase/migrations/20260722184318_map_gateway_provider_rounds.sql",
  import.meta.url,
)
const execution = new URL("../src/execute_admitted_chat.ts", import.meta.url)
const persistence = new URL("../src/persist_route.ts", import.meta.url)

test("continues tool calls within the database-mapped route allowance", async () => {
  const [sql, runtime, route] = await Promise.all([
    readFile(migration, "utf8"),
    readFile(execution, "utf8"),
    readFile(persistence, "utf8"),
  ])
  assert.match(sql, /maximum_answer_calls integer not null/u)
  assert.match(sql, /when 'quick' then 2/u)
  assert.match(sql, /when 'standard' then 3/u)
  assert.match(sql, /when 'deep' then 4/u)
  assert.match(sql, /when 'maximum' then 6/u)
  assert.match(sql, /answer_call > invocation\.maximum_answer_calls/u)
  assert.doesNotMatch(sql, /p_round not between 1 and 3/u)
  assert.match(route, /maximum_answer_calls = profile\.maximum_answer_calls/u)
  assert.match(runtime, /while \(true\)/u)
  assert.match(runtime, /providerRound \+= 1/u)
  assert.match(runtime, /runToolCall/u)
  assert.doesNotMatch(runtime, /additional_tool_round_refused/u)
})
