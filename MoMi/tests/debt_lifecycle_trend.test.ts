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
const findings = [...constitution.findings, ...access.findings]
const trend = buildDebtLifecycleTrend(
  findings, registry,
)

test("renders deterministic bounded trend dimensions", () => {
  assert.equal(trend.total, 81)
  assert.equal(trend.as_of, registry.policy.as_of)
  assert.deepEqual(trend.by_issue, {
    "MOX-20": 56,
    "MOX-22": 15,
    "MOX-23": 7,
    "MOX-406": 3,
  })
  assert.deepEqual(trend.by_risk, { high: 81 })
  assert.deepEqual(trend.by_rule, {
    direct_private_relation_access: 80,
    direct_private_routine_call: 1,
  })
})

test("ages findings from introduction independently of subsequent reviews", () => {
  const fixture = structuredClone(registry)
  fixture.policy.as_of = "2026-08-25"
  for (const record of fixture.records) {
    record.introduced_on = "2026-08-18"
    record.reviewed_on = "2026-08-25"
  }
  fixture.records[0].introduced_on = "2026-07-18"
  assert.equal(buildDebtLifecycleTrend(findings, fixture).oldest_age_days, 38)
  fixture.policy.as_of = "2026-10-22"
  for (const record of fixture.records) record.reviewed_on = "2026-10-22"
  assert.equal(buildDebtLifecycleTrend(findings, fixture).oldest_age_days, 96)
})
