import assert from "node:assert/strict"
import test from "node:test"

import type { Architecture } from "../scripts/architecture/types.ts"
import { buildImpactPlan } from "../scripts/dev_loop/build_impact_plan.ts"
import type { BoundPlan, ValidationReceipt } from "../scripts/dev_loop/types.ts"
import { assertPlanMatchesValidation } from
  "../scripts/release/assert_plan_matches_validation.ts"

test("validation receipts cannot be reused for another base or candidate tree", () => {
  const architecture = { services: [], functions: [] } as unknown as Architecture
  const impact = buildImpactPlan(["docs/deployment.md"], architecture, new Map())
  const plan = {
    schema_version: 1,
    base: { ref: "base", sha: "a".repeat(40), tree: "b".repeat(40) },
    head: { ref: "head", sha: "c".repeat(40), tree: "d".repeat(40) },
    changed_paths: ["docs/deployment.md"],
    diff_sha256: "e".repeat(64), impact_sha256: "f".repeat(64), impact,
  } as BoundPlan
  const validation = {
    identities: { base_sha: plan.base.sha, base_tree: plan.base.tree,
      head_sha: plan.head.sha, head_tree: plan.head.tree,
      development_sha: plan.base.sha, development_tree: plan.base.tree,
      diff_sha256: plan.diff_sha256, impact_sha256: plan.impact_sha256 },
    gate: "path_scoped",
  } as ValidationReceipt
  assert.doesNotThrow(() => assertPlanMatchesValidation(plan, validation))
  for (const identities of [
    { ...validation.identities, base_tree: "1".repeat(40) },
    { ...validation.identities, head_sha: "2".repeat(40) },
    { ...validation.identities, head_tree: "3".repeat(40) },
    { ...validation.identities, development_sha: "4".repeat(40) },
    { ...validation.identities, development_tree: "5".repeat(40) },
  ]) assert.throws(
    () => assertPlanMatchesValidation(plan, { ...validation, identities }),
    /Release plan differs materially/u,
  )
})
