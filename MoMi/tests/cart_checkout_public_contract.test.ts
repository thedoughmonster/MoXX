import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import Ajv2020 from "ajv/dist/2020.js"

const root = new URL("../services/cart-checkout-operations/", import.meta.url)

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(new URL(path, root), "utf8")) as T
}

type ContractIndex = {
  "x-momi-contracts": Record<string, Record<string, string>>
  $defs: Record<string, { enum?: string[] }>
}

type Manifest = {
  contracts: { provides: string[] }
  database: { read: string[]; write: string[] }
  deployment: { owns: unknown[] }
  functions: string[]
  implementation_status: string
  runtime_dependencies: string[]
}

const schema = await readJson<ContractIndex>(
  "contracts/cart-checkout-public-v1.schema.json",
)
const ajv = new Ajv2020({ allErrors: true })
ajv.addKeyword({ keyword: "x-momi-contracts", schemaType: "object" })
ajv.addFormat("uuid", /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
ajv.addFormat("email", /^[^@\s]+@[^@\s]+\.[^@\s]+$/)
ajv.addFormat("date-time", (value: string) =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  !Number.isNaN(Date.parse(value)))

test("one declared owner indexes contracts without runtime authority", async () => {
  const manifest = await readJson<Manifest>("service.json")

  assert.equal(ajv.validateSchema(schema), true, ajv.errorsText(ajv.errors))
  ajv.addSchema(schema, "cart-checkout")
  assert.deepEqual(Object.keys(schema["x-momi-contracts"]).sort(), [...manifest.contracts.provides].sort())
  assert.equal(manifest.implementation_status, "declared")
  assert.deepEqual(manifest.functions, [])
  assert.deepEqual(manifest.database, { read: [], write: [] })
  assert.deepEqual(manifest.deployment.owns, [])
  assert.deepEqual(manifest.runtime_dependencies, [])
  for (const refs of Object.values(schema["x-momi-contracts"])) {
    for (const ref of Object.values(refs)) assert.ok(ajv.getSchema(`cart-checkout${ref}`), ref)
  }
})

test("entry-flow fixtures share one validated contribution shape", async () => {
  const fixtures = await readJson<Array<{ flow_key: string }>>(
    "fixtures/flow-contributions.json",
  )
  const validate = ajv.getSchema("cart-checkout#/$defs/FlowContribution")

  assert.ok(validate)
  for (const fixture of fixtures) assert.equal(validate(fixture), true, ajv.errorsText(validate.errors))
  assert.deepEqual(fixtures.map(({ flow_key }) => flow_key), [
    "preorder", "catalog", "event_menu", "direct_link",
  ])
})

test("customer-safe fixtures validate every coherent status variant", async () => {
  const fixtures = await readJson<Array<Record<string, unknown>>>(
    "fixtures/customer-states.json",
  )
  const validate = ajv.getSchema("cart-checkout#/$defs/CheckoutStatusResponse")
  const expected = schema.$defs.CustomerSafeState.enum ?? []

  assert.ok(validate)
  for (const fixture of fixtures) assert.equal(validate(fixture), true, ajv.errorsText(validate.errors))
  assert.deepEqual(fixtures.map(({ customer_state }) => customer_state).sort(), [...expected].sort())
})

test("order-change fixture validates as an immutable reference only", async () => {
  const reference = await readJson<Record<string, unknown>>(
    "fixtures/order-change-reference.json",
  )
  const validate = ajv.getSchema("cart-checkout#/$defs/OrderChangeReference")

  assert.ok(validate)
  assert.equal(validate(reference), true, ajv.errorsText(validate.errors))
  assert.deepEqual(Object.keys(reference).sort(), [
    "change_id", "event_id", "occurred_at", "order_id", "order_version",
    "owner_read_ref",
  ])
  assert.deepEqual(Object.keys(reference.owner_read_ref as object).sort(), [
    "contract_key", "owner_service", "resource_id", "resource_version",
  ])
})
