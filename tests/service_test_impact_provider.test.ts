import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { canonicalJson } from "../scripts/dev_loop/canonical_json.ts"
import { provideServiceTestImpact } from
  "../scripts/architecture/provide_service_test_impact.ts"
import { ServiceTestImpactError } from
  "../scripts/architecture/service_test_impact_types.ts"
import { createServiceTestImpactFixture } from
  "./service_test_impact_fixture.ts"

test("resolves all seven categories deterministically and preserves reasons", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "momi-test-impact-"))
  t.after(async () => await rm(root, { recursive: true, force: true }))
  const { architecture } = await createServiceTestImpactFixture(root)
  const first = await provideServiceTestImpact(
    architecture, ["preorder-operations"], ["migration"], root,
  )
  const second = await provideServiceTestImpact(
    architecture, ["preorder-operations"], ["migration"], root,
  )
  assert.equal(canonicalJson(first), canonicalJson(second))
  const reordered = await provideServiceTestImpact(
    { services: [...architecture.services].reverse() },
    ["preorder-operations"], ["migration"], root,
  )
  assert.equal(canonicalJson(first), canonicalJson(reordered))
  assert.equal(first.tests.length, 7)
  assert.deepEqual(first.tests.map((item) => item.test),
    [...first.tests.map((item) => item.test)].sort())
  assert.equal(first.tests.flatMap((item) => item.reasons).length, 8)
  assert.deepEqual(new Set(first.tests.flatMap((item) =>
    item.reasons.map((reason) => reason.category))), new Set([
    "local_unit", "local_integration", "provider_contract",
    "consumer_contract", "cross_service_integration", "mandatory_global",
    "risk_triggered",
  ]))
  assert.deepEqual(first.tests.find((item) =>
    item.test === "tests/risk.test.ts")?.reasons[0].matched_triggers,
  ["migration"])
})

test("gates risk selectors and distinguishes absent from declared empty", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "momi-test-impact-"))
  t.after(async () => await rm(root, { recursive: true, force: true }))
  const { architecture } = await createServiceTestImpactFixture(root)
  const runtime = await provideServiceTestImpact(
    architecture, ["preorder-operations"], ["runtime"], root,
  )
  assert(!runtime.tests.some((item) => item.test === "tests/risk.test.ts"))
  const absent = await provideServiceTestImpact(
    architecture, ["square-payment-acquisition"], ["runtime"], root,
  )
  assert.equal(absent.metadata[0].status, "metadata_absent")
  assert.deepEqual(absent.diagnostics.map((item) => item.code),
    ["metadata_absent"])
  await assert.rejects(() => provideServiceTestImpact(
    architecture, ["square-payment-acquisition"], ["runtime"], root, true,
  ), (error: unknown) => error instanceof ServiceTestImpactError &&
    error.diagnostics.some((item) =>
      item.code === "selection_empty_when_required"))
})

test("selected tests cannot widen worker authority", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "momi-test-impact-"))
  t.after(async () => await rm(root, { recursive: true, force: true }))
  const { architecture, authority } = await createServiceTestImpactFixture(root)
  const before = canonicalJson(authority)
  const result = await provideServiceTestImpact(
    architecture, ["preorder-operations"], ["migration"], root,
  )
  assert.equal(canonicalJson(authority), before)
  assert.deepEqual(Object.keys(result).sort(),
    ["diagnostics", "metadata", "tests"])
  assert(result.tests.some((item) =>
    item.reasons.some((reason) => reason.services.length > 1)))
  assert(!canonicalJson(result).includes("filesystem_write"))
})
