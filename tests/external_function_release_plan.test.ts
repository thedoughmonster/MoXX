import assert from "node:assert/strict"
import test from "node:test"

import type { Architecture } from "../scripts/architecture/types.ts"
import { buildImpactPlan } from "../scripts/dev_loop/build_impact_plan.ts"

const architecture = {
  services: [],
  functions: [],
} as unknown as Architecture

test("external authority changes require development inventory parity", () => {
  const plan = buildImpactPlan(
    ["external-functions/momi-agent-control-dispatch-v1.json"],
    architecture,
    new Map(),
  )
  assert.equal(plan.final_gate.kind, "full")
  assert.equal(plan.release.hosted_inventory, "development_full_parity")
  assert.deepEqual(plan.release.services, [])
  assert.deepEqual(plan.release.functions, [])
})
