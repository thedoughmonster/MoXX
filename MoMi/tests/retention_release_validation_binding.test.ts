import assert from "node:assert/strict"
import test from "node:test"
import type { BoundPlan, ValidationReceipt } from "../scripts/dev_loop/types.ts"
import { assertRetentionValidationBinding } from "../scripts/release/retention/assert_validation_binding.ts"
import { retentionApprovalFixture } from "./fixtures/retention_release_approval.ts"

test("accepts the exact impact-selected gate and rejects altered tree, diff, impact or evidence", () => {
  const {approval} = retentionApprovalFixture()
  const plan = {base:{tree:"b".repeat(40)},diff_sha256:"c".repeat(64),
    impact_sha256:"d".repeat(64),impact:{final_gate:{kind:"path_scoped"}}} as BoundPlan
  const validation = {counts:{hard_failed:0},gate:"path_scoped",required_job:"validate-final",
    identities:{base_tree:plan.base.tree,diff_sha256:plan.diff_sha256,impact_sha256:plan.impact_sha256,
      head_sha:approval.validation.head_sha,head_tree:"e".repeat(40)},
    run_log:{run_id:String(approval.validation.run_id)}} as ValidationReceipt
  assert.doesNotThrow(()=>assertRetentionValidationBinding(approval,validation,plan,"e".repeat(40)))
  for (const override of [{gate:"full"}, {required_job:"local-focused"},
    {run_log:{run_id:"99"}}, {counts:{hard_failed:1}}]) {
    assert.throws(()=>assertRetentionValidationBinding(approval,{...validation,...override} as ValidationReceipt,
      plan,"e".repeat(40)))
  }
  for (const key of ["base_tree","diff_sha256","impact_sha256","head_sha","head_tree"] as const) {
    assert.throws(()=>assertRetentionValidationBinding(approval,{...validation,
      identities:{...validation.identities,[key]:"0".repeat(64)}},plan,"e".repeat(40)))
  }
})
