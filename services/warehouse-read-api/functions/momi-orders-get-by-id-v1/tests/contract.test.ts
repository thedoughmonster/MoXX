import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { parseOrderRead } from "../src/parse_request.ts"

const id = "11111111-1111-4111-8111-111111111111"

test("requires canonical UUIDs and a durable token", () => {
  assert.ok(parseOrderRead({ work_id: "1", order_id: id,
    capability_token: id }))
  assert.equal(parseOrderRead({ work_id: "1", order_id: "source-id",
    capability_token: id }), null)
  assert.equal(parseOrderRead({ work_id: "1", order_id: id,
    trigger_token: id }), null)
  assert.equal(parseOrderRead({ work_id: "1", order_id: id,
    capability_token: id, trigger_token: id }), null)
})

test("canonical output contract requires no source DTO", async () => {
  const contract = await readFile(new URL("../contracts/output.schema.json",
    import.meta.url), "utf8")
  assert.doesNotMatch(contract, /toast|payload/i)
})

test("reader atomically consumes its scoped capability", async () => {
  const [reader, manifestText, registration, consumption] = await Promise.all([
    readFile(new URL("../src/read_order.ts", import.meta.url), "utf8"),
    readFile(new URL("../function.json", import.meta.url), "utf8"),
    readFile(new URL(
      "../../../../../supabase/migrations/20260714174941_register_warehouse_reader_contracts.sql",
      import.meta.url), "utf8"),
    readFile(new URL(
      "../../../../../supabase/migrations/20260715064305_consume_order_read_capabilities.sql",
      import.meta.url), "utf8"),
  ])
  const manifest = JSON.parse(manifestText) as {
    authentication_policy_key: string
  }
  const hash = createHash("sha256").update(manifestText).digest("hex")
  assert.equal(manifest.authentication_policy_key,
    "durable.read_capability.v1")
  assert.match(registration, new RegExp(hash))
  assert.match(registration, /durable\.read_capability\.v1/)
  assert.match(reader, /momi_api\.consume_read_capability/)
  assert.match(consumption, /set consumed_at = now\(\)/)
  assert.match(consumption, /capability\.subject_entity_id = p_subject_entity_id/)
  assert.match(consumption, /delivery\.status = 'running'/)
  assert.match(consumption, /attempt\.outcome = 'running'/)
  assert.doesNotMatch(reader, /momi_orders|trigger_token/)
})
