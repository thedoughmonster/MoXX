import assert from "node:assert/strict"
import test from "node:test"

import { buildCompactReceipt } from "../scripts/dev_loop/build_compact_receipt.ts"
import { renderAgentValidationSummary } from
  "../scripts/dev_loop/render_agent_validation_summary.ts"

test("equivalent diagnostics bound locations and retain the affected count", () => {
  const stderr = Array.from({ length: 5000 }, (_, index) =>
    `src/file-${index}.ts:${index + 1}:2 rule/example: invalid value`
  ).join("\n")
  const receipt = buildCompactReceipt({ kind: "validation", commands: [{
    id: "many-locations", enforcement: "hard_stop", status: 1,
    duration_ms: 5, stderr,
    stdout_path: ".momi/logs/many-locations.stdout.log",
    stderr_path: ".momi/logs/many-locations.stderr.log",
  }] })
  const diagnostic = receipt.commands[0].diagnostics?.[0]
  const summary = renderAgentValidationSummary(receipt, ".momi/receipt.json")
  assert.equal(diagnostic?.occurrences, 5000)
  assert.equal(diagnostic?.location_count, 5000)
  assert.equal(diagnostic?.locations.length, 12)
  assert.match(summary, /\+4988 more affected; 5000 total in raw logs/u)
  assert.ok(summary.length < 5000)
  assert.ok(JSON.stringify(receipt).length < 5000)
})
