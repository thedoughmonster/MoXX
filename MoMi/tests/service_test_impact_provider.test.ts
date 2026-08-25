import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { canonicalJson } from "../scripts/dev_loop/canonical_json.ts"
import { workspaceRoot } from "../scripts/architecture/paths.ts"
import { provideServiceTestImpact } from "../scripts/architecture/provide_service_test_impact.ts"
import { ServiceTestImpactError } from "../scripts/architecture/service_test_impact_types.ts"
import { validateArchitecture } from "../scripts/architecture/validate_architecture.ts"
import { createServiceTestImpactFixture } from "./service_test_impact_fixture.ts"

const ordinaryPilotPaths = [
  "services/preorder-operations/functions/momi-preorder-bootstrap-v1/tests/bootstrap.test.ts",
  "services/preorder-operations/functions/momi-preorder-checkout-hold-v1/tests/hold.test.ts",
  "services/preorder-operations/functions/momi-preorder-order-intent-v1/tests/lifecycle_migration.test.ts",
  "services/preorder-operations/functions/momi-preorder-order-intent-v1/tests/order_intent.test.ts",
  "services/preorder-operations/functions/momi-preorder-order-status-v1/tests/order_status.test.ts",
  "services/preorder-operations/functions/momi-preorder-payment-initiate-v1/tests/initiate.test.ts",
  "services/preorder-operations/functions/momi-preorder-payment-reconcile-v1/tests/reconcile.test.ts",
  "services/preorder-operations/functions/momi-preorder-quote-v1/tests/quote.test.ts",
  "services/preorder-operations/functions/momi-preorder-quote-v1/tests/quote_failures.test.ts",
  "services/preorder-operations/functions/momi-preorder-quote-v1/tests/quote_migration.test.ts",
  "services/preorder-operations/functions/momi-preorder-square-webhook-v1/tests/webhook.test.ts",
  "services/preorder-operations/tests/config_publication.test.ts",
  "services/preorder-operations/tests/launch_policy_v3.test.ts",
  "services/preorder-operations/tests/payment_contract.test.ts",
  "services/preorder-operations/tests/payment_handler_contract.test.ts",
  "services/preorder-operations/tests/payment_status_contract.test.ts",
  "services/preorder-operations/tests/preorder_payment_postgres.test.ts",
  "services/preorder-operations/tests/pricing_eligibility_policy.test.ts",
  "services/preorder-operations/tests/public_contract.test.ts",
  "services/preorder-operations/tests/public_origin.test.ts",
  "tests/dev_loop_determinism.test.ts",
  "tests/dev_loop_release_plan.test.ts",
  "tests/retired_development_protocol.test.ts",
]

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

test("resolves the 23/24-path pilot without widening authority", async () => {
  const architecture = await validateArchitecture()
  const authority = { filesystem: [], database: [], network: [], secrets: [], provider: [], runtime: [], deployment: [], external_configuration: [] }
  const before = canonicalJson(authority)
  const ordinary = await provideServiceTestImpact(
    architecture, ["preorder-operations"], ["manifest"], workspaceRoot, true,
  )
  const migration = await provideServiceTestImpact(
    architecture, ["preorder-operations"], ["migration"], workspaceRoot, true,
  )
  assert.equal(canonicalJson(authority), before)
  assert.deepEqual(ordinary.tests.map((item) => item.test), ordinaryPilotPaths)
  assert.deepEqual(migration.tests.map((item) => item.test), [
    ...ordinaryPilotPaths,
    "services/preorder-operations/tests/preorder_lifecycle_postgres.test.ts",
  ].sort())
  assert.equal(ordinary.tests.flatMap((item) => item.reasons).length, 23)
  assert.equal(migration.tests.flatMap((item) => item.reasons).length, 24)
  assert.deepEqual(ordinary.metadata.map((item) => item.status), ["declared"])
  assert.deepEqual(ordinary.diagnostics, [])
  const categories = new Set(ordinary.tests.flatMap((item) =>
    item.reasons.map((reason) => reason.category)))
  assert(categories.has("mandatory_global"))
  assert(categories.has("cross_service_integration"))
  const visible = canonicalJson({ ordinary, migration })
  for (const field of Object.keys(authority)) {
    assert(!visible.includes(`"${field}"`), field)
  }
})
