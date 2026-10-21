import assert from "node:assert/strict"
import test from "node:test"

import type { Architecture } from "../scripts/architecture/types.ts"
import { buildImpactPlan } from "../scripts/dev_loop/build_impact_plan.ts"
import { selectFunctions } from "../scripts/deploy/select_functions.ts"

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

test("external retained ownership cannot select a deployment service", () => {
  const retained = {
    ...architecture,
    externalFunctionAuthorities: [{
      function_slug: "external-v1",
      owner_service: "external-service",
      lifecycle_status: "retired_retained",
    }],
  } as unknown as Architecture
  assert.throws(() => selectFunctions(retained, ["external-service"]), /Unknown services/)
  const plan = buildImpactPlan(
    ["external-functions/external-v1.json"], retained, new Map(),
  )
  assert.deepEqual(plan.release.functions, [])
  assert.deepEqual(plan.release.services, [])
})
