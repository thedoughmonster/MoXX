import assert from "node:assert/strict"
import test from "node:test"

import { buildDebtLifecycleTrend } from
  "../scripts/constitution/build_debt_lifecycle_trend.ts"
import { loadAccessBaseline } from
  "../scripts/constitution/load_access_baseline.ts"
import { loadConstitutionBaseline } from
  "../scripts/constitution/load_constitution_baseline.ts"
import { loadDebtLifecycleRegistry } from
  "../scripts/constitution/load_debt_lifecycle_registry.ts"

const access = await loadAccessBaseline()
const constitution = await loadConstitutionBaseline()
const registry = await loadDebtLifecycleRegistry()
const trend = buildDebtLifecycleTrend(
  [...constitution.findings, ...access.findings],
  registry,
)

test("renders deterministic bounded trend dimensions", () => {
  assert.equal(trend.total, 82)
  assert.equal(trend.oldest_age_days, 38)
  assert.deepEqual(trend.by_issue, {
    "MOX-20": 57,
    "MOX-22": 15,
    "MOX-23": 7,
    "MOX-406": 3,
  })
  assert.deepEqual(trend.by_risk, { high: 82 })
  assert.deepEqual(trend.by_rule, {
    direct_private_relation_access: 80,
    direct_private_routine_call: 1,
    dynamic_relation_identifier: 1,
  })
})
