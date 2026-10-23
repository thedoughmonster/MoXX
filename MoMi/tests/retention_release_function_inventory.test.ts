import assert from "node:assert/strict"
import test from "node:test"
import { retentionFunctionInventory } from "../scripts/release/retention/function_inventory.ts"
import { retentionFunctionSlug } from "../scripts/release/retention/policy.ts"

test("fingerprints function state and detects unrelated drift while rejecting unverifiable inventory", () => {
  const unrelated = { slug: "synthetic-worker", version: 1, ezbr_sha256: "a".repeat(64),
    status: "ACTIVE", verify_jwt: true }
  const governor = { slug: retentionFunctionSlug, version: 2, ezbr_sha256: "b".repeat(64),
    status: "ACTIVE", verify_jwt: false }
  const baseline = retentionFunctionInventory(JSON.stringify([unrelated, governor]))
  const reordered = retentionFunctionInventory(JSON.stringify({ functions: [governor, unrelated] }))
  assert.deepEqual(reordered, baseline)
  assert.match(baseline.sha256, /^[a-f0-9]{64}$/)
  assert.deepEqual(baseline.rows, [governor, unrelated])
  assert.equal(retentionFunctionInventory("[]").unrelated, "[]")
  const changedGovernor = retentionFunctionInventory(JSON.stringify([
    unrelated, { ...governor, version: 3, ezbr_sha256: "c".repeat(64) },
  ]))
  assert.notEqual(changedGovernor.sha256, baseline.sha256)
  assert.equal(changedGovernor.unrelated, baseline.unrelated)
  for (const mutation of [
    { slug: "renamed-worker" }, { version: 4 }, { ezbr_sha256: "d".repeat(64) },
    { status: "INACTIVE" }, { verify_jwt: false },
  ]) {
    const changed = retentionFunctionInventory(JSON.stringify([{ ...unrelated, ...mutation }, governor]))
    assert.notEqual(changed.sha256, baseline.sha256)
    assert.notEqual(changed.unrelated, baseline.unrelated)
  }
  for (const rows of [[governor], [unrelated, governor, { ...unrelated, slug: "extra-worker" }]]) {
    const changed = retentionFunctionInventory(JSON.stringify(rows))
    assert.notEqual(changed.unrelated, baseline.unrelated)
  }
  for (const source of ["{", "null", "{}", "42", '"inventory"', '{"functions":null}',
    '{"functions":{}}', '[null]', '["worker"]', JSON.stringify([{ ...unrelated, slug: 1 }]),
    JSON.stringify([{ ...unrelated, version: "1" }]),
    JSON.stringify([{ ...unrelated, ezbr_sha256: null }]),
    JSON.stringify([{ slug: "missing-fields" }]),
    JSON.stringify([unrelated, { ...unrelated, version: 2 }]),
  ]) assert.throws(() => retentionFunctionInventory(source))
})
