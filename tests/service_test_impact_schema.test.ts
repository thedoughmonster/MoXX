import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { validateJson } from "../scripts/architecture/validate_json.ts"

const schema = JSON.parse(await readFile(
  "schemas/service-manifest-v1.schema.json", "utf8",
))
const manifest = JSON.parse(await readFile(
  "services/preorder-operations/service.json", "utf8",
))
const categories = {
  local_unit: [], local_integration: [], provider_contract: [],
  consumer_contract: [], cross_service_integration: [], mandatory_global: [],
  risk_triggered: [],
}

test("accepts the 24-selector pilot, absence, and explicit empty metadata", () => {
  const absent = structuredClone(manifest)
  delete absent.test_impact
  assert.deepEqual(Object.values(manifest.test_impact.categories)
    .map((selectors: unknown[]) => selectors.length), [9, 8, 1, 1, 1, 3, 1])
  assert.doesNotThrow(() => validateJson(schema, manifest, "manifest"))
  assert.doesNotThrow(() => validateJson(schema, absent, "manifest"))
  assert.doesNotThrow(() => validateJson(schema, {
    ...manifest,
    test_impact: {
      schema_version: 1,
      owner_service: "preorder-operations",
      categories,
    },
  }, "manifest"))
})

test("rejects incompatible, incomplete, and extended metadata", () => {
  const cases = [{ schema_version: 2, owner_service: "preorder-operations",
    categories }, { schema_version: 1, owner_service: "preorder-operations",
    categories: { ...categories, risk_triggered: undefined } }, {
    schema_version: 1, owner_service: "preorder-operations", categories,
    invented: true,
  }]
  for (const test_impact of cases) assert.throws(
    () => validateJson(schema, { ...manifest, test_impact }, "manifest"),
  )
})

test("rejects unknown selector fields and malformed stable identities", () => {
  const selector = { id: "wrong", test: "tests/example.test.ts",
    reason: "Example.", services: ["preorder-operations"], contracts: [],
    triggers: [], extra: true }
  assert.throws(() => validateJson(schema, { ...manifest, test_impact: {
    schema_version: 1, owner_service: "preorder-operations",
    categories: { ...categories, local_unit: [selector] },
  } }, "manifest"))
})
