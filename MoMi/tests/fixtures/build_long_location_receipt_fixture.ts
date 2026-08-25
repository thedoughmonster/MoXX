import { closeSync, mkdirSync, openSync, unlinkSync, writeSync } from "node:fs"

import { buildCompactReceipt } from
  "../../scripts/dev_loop/build_compact_receipt.ts"
import { renderAgentValidationSummary } from
  "../../scripts/dev_loop/render_agent_validation_summary.ts"

const path = ".momi/logs/long-locations.stderr.log"
const pathPrefix = `src/${"a".repeat(16000)}`
mkdirSync(".momi/logs", { recursive: true })
const descriptor = openSync(path, "w")
for (let index = 0; index < 512; index += 1) {
  writeSync(descriptor,
    `${pathPrefix}-${index}.ts:1:1 rule/long: repeated failure\n`)
}
closeSync(descriptor)
try {
  const receipt = buildCompactReceipt({ kind: "validation", commands: [{
    id: "long-locations", enforcement: "hard_stop", status: 1,
    duration_ms: 1, stderr_path: path,
  }] })
  const diagnostic = receipt.commands[0].diagnostics?.[0]
  const summary = renderAgentValidationSummary(receipt, ".momi/receipt.json")
  const locations = diagnostic?.locations ?? []
  process.stdout.write(`${diagnostic?.occurrences}:${diagnostic?.location_count}:` +
    `${locations.length}:${diagnostic?.location_count_capped ?? false}:` +
    `${JSON.stringify(receipt).length}:${summary.length}:` +
    `${Math.max(...locations.map((item) => item.length))}:` +
    `${locations.every((item) => item.includes("[sha256:"))}:` +
    `${locations.every((item) => item.includes(".ts:1:1"))}\n`)
} finally {
  unlinkSync(path)
}
