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

test("checkout states reject payment, phase, issue, and confirmation contradictions", async () => {
  const fixtures = await readJson<Array<Record<string, unknown>>>(
    "fixtures/customer-states.json",
  )
  const byState = Object.fromEntries(fixtures.map((value) => [value.customer_state, value]))
  const validate = ajv.getSchema("cart-checkout#/$defs/CheckoutStatusResponse")
  const invalid = [
    { ...byState.indeterminate, next_actions: ["retry_payment"] },
    { ...byState.confirmed, payment_status: "pending" },
    { ...byState.confirmed, confirmation_ref: null },
    { ...byState.pending, confirmation_ref: byState.confirmed.confirmation_ref },
    { ...byState.declined, phase: "pending" },
    { ...byState.declined, issues: byState.indeterminate.issues },
  ]

  assert.ok(validate)
  for (const value of invalid) assert.equal(validate(value), false, JSON.stringify(value))
})

test("cart reads reject checkout-payment states and incoherent actions", () => {
  const validate = ajv.getSchema("cart-checkout#/$defs/CartReadResponse")
  const empty = {
    customer_state: "empty",
    projection_status: "current",
    order: null,
    next_actions: ["edit_cart"],
    issues: [],
  }
  const invalid = [
    {
      customer_state: "indeterminate",
      projection_status: "recovering",
      order: null,
      next_actions: ["retry_payment"],
      issues: [],
    },
    { ...empty, next_actions: ["retry_payment"] },
    { ...empty, projection_status: "stale" },
  ]

  assert.ok(validate)
  assert.equal(validate(empty), true, ajv.errorsText(validate.errors))
  for (const value of invalid) assert.equal(validate(value), false, JSON.stringify(value))
})

test("reference contracts reject malformed formats and forbidden material", async () => {
  const reference = await readJson<Record<string, unknown>>(
    "fixtures/order-change-reference.json",
  )
  const ownerReadRef = reference.owner_read_ref as Record<string, unknown>
  const validate = ajv.getSchema("cart-checkout#/$defs/OrderChangeReference")
  const invalid = [
    { ...reference, event_id: "not-a-uuid" },
    { ...reference, occurred_at: "not-a-date-time" },
    { ...reference, customer_contact: { email: "ada@example.com" } },
    { ...reference, payment_material: { token: "forbidden" } },
    { ...reference, owner_read_ref: { ...ownerReadRef, body: { cart: [] } } },
  ]

  assert.ok(validate)
  for (const value of invalid) assert.equal(validate(value), false, JSON.stringify(value))
})
