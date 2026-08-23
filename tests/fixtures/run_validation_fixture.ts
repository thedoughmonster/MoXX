import { commandExitCode } from "../../scripts/dev_loop/command_exit_code.ts"
import { runValidation } from "../../scripts/dev_loop/run_validation.ts"
import type { CheckCommand } from "../../scripts/dev_loop/types.ts"

const mode = process.argv[2]
const child = "tests/fixtures/validation_output_child.ts"
const checks: CheckCommand[] = [{
  id: mode === "success" ? "fixture-pass" : "fixture-failure",
  command: process.execPath,
  args: [child, mode === "success" ? "pass" : "duplicate"],
  enforcement: "hard_stop",
}]
if (mode === "multiple") checks.push({
  id: "fixture-missing", command: process.execPath,
  args: [child, "missing"], enforcement: "hard_stop",
}, {
  id: "fixture-advisory", command: process.execPath,
  args: [child, "advisory"], enforcement: "advisory",
  advisory: { rule: "quality-report-freshness",
    path: "docs/quality-metrics.json", regenerate: "pnpm quality:generate" },
})
const receipt = runValidation({
  kind: "validation",
  checks,
  receipt_path: ".momi/fixture-validation-receipt.json",
})
process.exit(commandExitCode(receipt))
