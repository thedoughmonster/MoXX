import assert from "node:assert/strict"
import test from "node:test"

import { buildCompactReceipt } from "../scripts/dev_loop/build_compact_receipt.ts"
import { renderAgentValidationSummary } from
  "../scripts/dev_loop/render_agent_validation_summary.ts"

let distinct = ""
for (let index = 0; index < 5000; index += 1) {
  distinct += `rule/distinct-${index}: failed\n`
}

test("distinct diagnostic tracking reports its memory bound", () => {
  const receipt = buildCompactReceipt({ kind: "validation", commands: [{
    id: "many-distinct", enforcement: "hard_stop", status: 1, duration_ms: 1,
    stderr: distinct,
  }] })
  assert.equal(receipt.commands[0].diagnostics?.length, 8)
  assert.equal(receipt.commands[0].additional_diagnostics, 4096)
  assert.equal(receipt.commands[0].additional_diagnostics_capped, true)
  assert.match(renderAgentValidationSummary(receipt, ".momi/receipt.json"),
    /\+4096 or more additional distinct diagnostics/u)
})
