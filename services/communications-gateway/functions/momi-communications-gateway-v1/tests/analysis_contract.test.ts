import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("../../../../../", import.meta.url)
const roleMigration = new URL(
  "supabase/migrations/20260722164106_add_gateway_analysis_reader_and_context.sql",
  root,
)
const queryMigration = new URL(
  "supabase/migrations/20260722164117_add_curated_shop_analysis_query_contract.sql",
  root,
)
const bindingMigration = new URL(
  "supabase/migrations/20260722172734_bind_analysis_executor_to_gateway_role.sql",
  root,
)
const toolSource = new URL(
  "services/communications-gateway/functions/momi-communications-gateway-v1/src/run_shop_analysis_tool.ts",
  root,
)

test("binds dynamic analysis to a non-login read-only database role", async () => {
  const role = await readFile(roleMigration, "utf8")
  const query = await readFile(queryMigration, "utf8")
  const binding = await readFile(bindingMigration, "utf8")
  const tool = await readFile(toolSource, "utf8")
  assert.match(role, /create role svc_communications_gateway\s+\n?\s*nologin/iu)
  assert.match(query, /security invoker/iu)
  assert.match(binding, /security definer/iu)
  assert.match(binding, /owner to svc_communications_gateway/iu)
  assert.match(binding, /with inherit false, set false/iu)
  assert.match(query, /current_setting\('transaction_read_only'\) <> 'on'/u)
  assert.match(query, /limit 101/iu)
  assert.match(query, /octet_length\(result::text\) > 65536/u)
  assert.doesNotMatch(query, /customer_label|first_name|last_name|email|phone/iu)
  assert.match(tool, /begin\("read only"/u)
  assert.match(tool, /set_config\('statement_timeout', '6000', true\)/u)
  assert.doesNotMatch(tool, /set local role/u)
  assert.doesNotMatch(tool, /\.unsafe\(/u)
})
