import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { parseOrderVersionRead } from "../src/parse_request.ts"

const orderId = "11111111-1111-4111-8111-111111111111"
const versionId = "22222222-2222-4222-8222-222222222222"
const tokenId = "33333333-3333-4333-8333-333333333333"
const validInput = { work_id: "1", order_id: orderId,
  order_version_id: versionId, capability_token: tokenId }

test("requires exactly the version-scoped canonical input", () => {
  assert.deepEqual(parseOrderVersionRead(validInput), validInput)
  assert.equal(parseOrderVersionRead({ ...validInput, source_id: orderId }), null)
  assert.equal(parseOrderVersionRead({ work_id: "1", order_id: orderId,
    capability_token: tokenId }), null)
  assert.equal(parseOrderVersionRead({ ...validInput,
    order_id: "source-id" }), null)
  assert.equal(parseOrderVersionRead({ ...validInput,
    order_version_id: "latest" }), null)
  assert.equal(parseOrderVersionRead({ ...validInput,
    capability_token: "token" }), null)
  assert.equal(parseOrderVersionRead({ ...validInput, work_id: "0" }), null)
  assert.equal(parseOrderVersionRead({ ...validInput,
    event_id: orderId, message_id: "1", delivery_token: tokenId }), null)
})

test("contracts expose the exact version without a source DTO", async () => {
  const [inputText, outputText, manifestText] = await Promise.all([
    readFile(new URL("../contracts/input.schema.json", import.meta.url), "utf8"),
    readFile(new URL("../contracts/output.schema.json", import.meta.url), "utf8"),
    readFile(new URL("../function.json", import.meta.url), "utf8"),
  ])
  const input = JSON.parse(inputText) as {
    additionalProperties: boolean
    required: string[]
    properties: Record<string, { format?: string }>
  }
  const output = JSON.parse(outputText) as { oneOf: Array<{
    required: string[]
    properties: Record<string, { const?: unknown, format?: string, enum?: string[] }>
  }> }
  const manifest = JSON.parse(manifestText) as {
    function_key: string
    route_path: string
    authentication_policy_key: string
  }
  assert.equal(input.additionalProperties, false)
  assert.deepEqual(input.required,
    ["work_id", "order_id", "order_version_id", "capability_token"])
  assert.equal(input.properties.order_id.format, "uuid")
  assert.equal(input.properties.order_version_id.format, "uuid")
  assert.equal(input.properties.capability_token.format, "uuid")
  assert.deepEqual(output.oneOf[0].required,
    ["ok", "contract_key", "contract_version", "trace_id", "work_id",
      "order_id", "order_version_id", "schema_version", "order_document",
      "order_presentation", "provenance", "freshness"])
  assert.equal(output.oneOf[0].properties.contract_key.const,
    "momi.orders.get_by_version.v1")
  assert.equal(output.oneOf[0].properties.order_version_id.format, "uuid")
  assert.deepEqual(output.oneOf[1].properties.error.enum,
    ["invalid_request", "forbidden", "contract_inactive", "order_not_found",
      "read_failed"])
  assert.equal(manifest.function_key, "momi.orders.get_by_version.v1")
  assert.equal(manifest.route_path,
    "/functions/v1/momi-orders-get-by-version-v1")
  assert.equal(manifest.authentication_policy_key, "durable.read_capability.v1")
  assert.doesNotMatch(outputText, /toast|payload/i)
})

test("reader consumes and resolves one exact order version", async () => {
  const [reader, handler, consumption] = await Promise.all([
    readFile(new URL("../src/read_order.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/handle_request.ts", import.meta.url), "utf8"),
    readFile(new URL(
      "../../../../../supabase/migrations/20260824141129_route_order_reads_through_delivery_v2.sql",
      import.meta.url), "utf8"),
  ])
  const capabilityCall = new RegExp([
    "momi_api\\.consume_versioned_read_capability\\(\\s*",
    "\\$\\{input\\.work_id\\}::bigint,\\s*",
    "\\$\\{functionKey\\},\\s*",
    "\\$\\{input\\.order_id\\}::uuid,\\s*",
    "\\$\\{input\\.order_version_id\\}::uuid,\\s*",
    "\\$\\{input\\.capability_token\\}::uuid\\s*\\)",
  ].join(""))
  assert.match(reader, capabilityCall)
  assert.match(reader, /where view_key = \$\{functionKey\}/)
  assert.match(reader, /contract_version = \$\{contractVersion\}/)
  assert.match(reader, /schema_name = 'momi_api'/)
  assert.match(reader, /view_or_function_name = 'order_versions_by_id_v1'/)
  assert.match(reader, /and active/)
  assert.match(reader,
    /order_record\.order_id = \$\{input\.order_id\}::uuid/)
  assert.match(reader,
    /order_record\.order_version_id = \$\{input\.order_version_id\}::uuid/)
  assert.match(handler, /order_version_id: row\.order_version_id/)
  assert.match(consumption, /momi\.order_alert_delivery\.v2/)
  assert.match(consumption, /acquire_order_alert_delivery_witness_v1/)
  assert.doesNotMatch(consumption, /momi_alerting\.|momi_events\.deliveries/)
  assert.doesNotMatch(reader, /toast|trigger_token/i)
})
