import assert from "node:assert/strict"
import test from "node:test"

import type { Architecture } from "../scripts/architecture/types.ts"
import { buildImpactPlan } from "../scripts/dev_loop/build_impact_plan.ts"

const architecture = { services: [], functions: [] } as unknown as Architecture

test("legacy debt evidence changes select the exclusion test", () => {
  const paths = [
    "tests/fixtures/legacy-debt-exclusion/control-execution-authority.json",
    "tests/legacy_debt_exclusion_test_support.ts",
    "docs/service-access-debt-baseline.json",
    "docs/legacy-access-governance-report.json",
  ]
  for (const path of paths) {
    const plan = buildImpactPlan([path], architecture, new Map())
    const focused = plan.iteration_checks.find((item) => item.id === "focused-tests")
    assert(focused?.args.includes("tests/legacy_debt_exclusion.test.ts"), path)
  }
  const unrelated = buildImpactPlan(["docs/deployment.md"], architecture, new Map())
  const focused = unrelated.iteration_checks.find((item) => item.id === "focused-tests")
  assert.equal(focused?.args.includes("tests/legacy_debt_exclusion.test.ts"), false)
})
