import { closeSync, mkdirSync, openSync, unlinkSync, writeSync } from "node:fs"

import { buildCompactReceipt } from "../../scripts/dev_loop/build_compact_receipt.ts"
import { hashFile } from "../../scripts/dev_loop/hash_file.ts"
import { renderAgentValidationSummary } from
  "../../scripts/dev_loop/render_agent_validation_summary.ts"

const path = ".momi/logs/constrained-heap.stderr.log"
mkdirSync(".momi/logs", { recursive: true })
const descriptor = openSync(path, "w")
for (let batch = 0; batch < 1024; batch += 1) {
  let block = ""
  for (let index = 0; index < 2048; index += 1) {
    block += `src/large-${batch}-${index}.ts:1:1 rule/large: repeated failure\n`
  }
  writeSync(descriptor, block)
}
closeSync(descriptor)
try {
  buildCompactReceipt({ kind: "validation", commands: [{
    id: "large-success", enforcement: "hard_stop", status: 0,
    duration_ms: 1, stdout_path: path, stdout_sha256: hashFile(path),
  }] })
  const receipt = buildCompactReceipt({ kind: "validation", commands: [{
    id: "large-failure", enforcement: "hard_stop", status: 1,
    duration_ms: 1, stderr_path: path, stderr_sha256: hashFile(path),
  }] })
  const diagnostic = receipt.commands[0].diagnostics?.[0]
  process.stdout.write(`${diagnostic?.occurrences}:${diagnostic?.location_count}:` +
    `${diagnostic?.location_count_capped}\n`)
  process.stdout.write(renderAgentValidationSummary(receipt, ".momi/receipt.json"))
} finally {
  unlinkSync(path)
}
