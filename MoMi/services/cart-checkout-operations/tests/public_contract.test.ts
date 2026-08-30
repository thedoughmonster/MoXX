import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import Ajv from "ajv"

const root = new URL("../", import.meta.url)

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(new URL(path, root), "utf8")) as T
}

type ContractIndex = {
  "x-momi-contracts": Record<string, Record<string, string>>
  $defs: Record<string, { enum?: string[] }>
}

type Manifest = { contracts: { provides: string[] }; implementation_status: string; functions: string[]; deployment: { owns: unknown[] } }

test("one declared owner indexes every shared contract without runtime bindings", async () => {
  const manifest = await readJson<Manifest>("service.json")
  const schema = await readJson<ContractIndex>(
    "contracts/cart-checkout-public-v1.schema.json",
  )

  assert.deepEqual(Object.keys(schema["x-momi-contracts"]).sort(), [...manifest.contracts.provides].sort())
  assert.equal(manifest.implementation_status, "declared")
  assert.deepEqual(manifest.functions, [])
  assert.deepEqual(manifest.deployment.owns, [])

  const ajv = new Ajv({ strict: false, validateFormats: false, validateSchema: false })
  ajv.addSchema(schema, "cart-checkout")
  for (const refs of Object.values(schema["x-momi-contracts"])) {
    for (const ref of Object.values(refs)) assert.ok(ajv.getSchema(`cart-checkout${ref}`), ref)
  }
})

test("preorder, catalog, event/menu, and direct-link fixtures share one contribution shape", async () => {
  const schema = await readJson<ContractIndex>("contracts/cart-checkout-public-v1.schema.json")
  const fixtures = await readJson<Array<{ flow_key: string }>>("fixtures/flow-contributions.json")
  const ajv = new Ajv({ strict: false, validateFormats: false, validateSchema: false })
  ajv.addSchema(schema, "cart-checkout")
  const validate = ajv.getSchema("cart-checkout#/$defs/FlowContribution")

  assert.ok(validate)
  for (const fixture of fixtures) assert.equal(validate(fixture), true, ajv.errorsText(validate.errors))
  assert.deepEqual(fixtures.map(({ flow_key }) => flow_key), ["preorder", "catalog", "event_menu", "direct_link"])
})

test("customer-safe fixtures cover the complete canonical vocabulary", async () => {
  const schema = await readJson<ContractIndex>("contracts/cart-checkout-public-v1.schema.json")
  const fixtures = await readJson<Array<{ customer_state: string }>>("fixtures/customer-states.json")
  const expected = schema.$defs.CustomerSafeState.enum ?? []

  assert.deepEqual(fixtures.map(({ customer_state }) => customer_state).sort(), [...expected].sort())
  for (const required of ["loading", "invalid", "stale", "pending", "declined", "indeterminate", "recovery_required", "confirmed"]) assert.ok(expected.includes(required))
})

test("order-change reference is schema-valid and contains references only", async () => {
  const schema = await readJson<ContractIndex>("contracts/cart-checkout-public-v1.schema.json")
  const reference = await readJson<Record<string, unknown>>("fixtures/order-change-reference.json")
  const ajv = new Ajv({ strict: false, validateFormats: false, validateSchema: false })
  ajv.addSchema(schema, "cart-checkout")
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
