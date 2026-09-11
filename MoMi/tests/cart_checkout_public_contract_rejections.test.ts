import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import Ajv2020 from "ajv/dist/2020.js"

const root = new URL("../services/cart-checkout-operations/", import.meta.url)

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(new URL(path, root), "utf8")) as T
}

const schema = await readJson<object>(
  "contracts/cart-checkout-public-v1.schema.json",
)
const ajv = new Ajv2020({ allErrors: true })
ajv.addKeyword({ keyword: "x-momi-contracts", schemaType: "object" })
ajv.addFormat("uuid", /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
ajv.addFormat("email", /^[^@\s]+@[^@\s]+\.[^@\s]+$/)
ajv.addFormat("date-time", (value: string) =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  !Number.isNaN(Date.parse(value)))
ajv.addSchema(schema, "cart-checkout")

const commandId = "70000000-0000-4000-8000-000000000001"
const orderId = "70000000-0000-4000-8000-000000000002"
const lineId = "70000000-0000-4000-8000-000000000003"
const shoppingAuthorityId = "70000000-0000-4000-8000-000000000004"

test("draft-order mutations reject incomplete actions and unfenced orders", async () => {
  const contribution = (await readJson<Array<Record<string, unknown>>>(
    "fixtures/flow-contributions.json",
  ))[0]
  const base = { command_id: commandId, shopping_authority_id: shoppingAuthorityId }
  const validate = ajv.getSchema("cart-checkout#/$defs/DraftOrderMutationRequest")
  const valid = [
    { ...base, order_id: null, expected_order_version: null, action: "contribute", contribution },
    { ...base, order_id: orderId, expected_order_version: 1, action: "contribute", contribution },
    { ...base, order_id: orderId, expected_order_version: 1, action: "replace", line_id: lineId, contribution },
    { ...base, order_id: orderId, expected_order_version: 1, action: "remove", line_id: lineId },
    { ...base, order_id: orderId, expected_order_version: 1, action: "clear" },
  ]
  const invalid = [
    { ...base, order_id: null, expected_order_version: 1, action: "contribute", contribution },
    { ...base, order_id: orderId, expected_order_version: null, action: "contribute", contribution },
    { ...base, order_id: orderId, expected_order_version: 0, action: "clear" },
    { ...base, order_id: null, expected_order_version: null, action: "contribute" },
    { ...base, order_id: null, expected_order_version: null, action: "contribute", line_id: lineId, contribution },
    { ...base, order_id: orderId, expected_order_version: 1, action: "replace", contribution },
    { ...base, order_id: orderId, expected_order_version: 1, action: "replace", line_id: lineId },
    { ...base, order_id: orderId, expected_order_version: 1, action: "remove", line_id: lineId, contribution },
    { ...base, order_id: orderId, expected_order_version: 1, action: "clear", line_id: lineId },
  ]

  assert.ok(validate)
  for (const value of valid) assert.equal(validate(value), true, ajv.errorsText(validate.errors))
  for (const value of invalid) assert.equal(validate(value), false, JSON.stringify(value))
})

test("contribution submission pairs first creation and existing-order fences", async () => {
  const contribution = (await readJson<Array<Record<string, unknown>>>(
    "fixtures/flow-contributions.json",
  ))[0]
  const validate = ajv.getSchema("cart-checkout#/$defs/FlowContributionRequest")
  const base = { command_id: commandId, shopping_authority_id: shoppingAuthorityId, contribution }

  assert.ok(validate)
  assert.equal(validate({ ...base, order_id: null, expected_order_version: null }), true)
  assert.equal(validate({ ...base, order_id: orderId, expected_order_version: 2 }), true)
  assert.equal(validate({ ...base, order_id: null, expected_order_version: 2 }), false)
  assert.equal(validate({ ...base, order_id: orderId, expected_order_version: null }), false)
})

test("checkout commands require only their discriminated payload", async () => {
  const contribution = (await readJson<Array<Record<string, unknown>>>(
    "fixtures/flow-contributions.json",
  ))[0]
  const fulfillment = contribution.fulfillment_ref
  const base = { command_id: commandId, order_id: orderId, expected_order_version: 2 }
  const contact = { name: "Ada Customer", email: "ada@example.com" }
  const validate = ajv.getSchema("cart-checkout#/$defs/CheckoutCommandRequest")
  const valid = [
    { ...base, action: "begin" },
    { ...base, action: "save_contact", contact },
    { ...base, action: "confirm_fulfillment", fulfillment_ref: fulfillment },
  ]
  const invalid = [
    { ...base, action: "save_contact" },
    { ...base, action: "confirm_fulfillment" },
    { ...base, action: "begin", contact },
    { ...base, action: "save_contact", contact, fulfillment_ref: fulfillment },
    { ...base, action: "save_contact", contact: { name: "Ada", email: "invalid" } },
    { ...base, order_id: "not-a-uuid", action: "begin" },
    { ...base, expected_order_version: 0, action: "begin" },
  ]

  assert.ok(validate)
  for (const value of valid) assert.equal(validate(value), true, ajv.errorsText(validate.errors))
  for (const value of invalid) assert.equal(validate(value), false, JSON.stringify(value))
})
