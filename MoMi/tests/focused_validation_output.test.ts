import assert from "node:assert/strict"
import test from "node:test"

import { buildCompactReceipt } from "../scripts/dev_loop/build_compact_receipt.ts"
import { renderAgentValidationSummary } from
  "../scripts/dev_loop/render_agent_validation_summary.ts"

test("focused summaries cannot be mistaken for exact-HEAD final evidence", () => {
  const receipt = buildCompactReceipt({ kind: "validation", commands: [{
    id: "focused-tests", enforcement: "hard_stop", status: 0, duration_ms: 1,
  }] })
  const summary = renderAgentValidationSummary(
    receipt,
    ".momi/focused-validation-receipt.json",
    "Focused non-final validation",
  )
  assert.match(summary, /^Focused non-final validation PASS:/u)
  assert.doesNotMatch(summary, /^Validation PASS:/u)
})
