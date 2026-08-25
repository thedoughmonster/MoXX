import { commandExitCode } from "../../scripts/dev_loop/command_exit_code.ts"
import { repositoryHardCheckIds } from
  "../../scripts/dev_loop/repository_validation_contract.ts"
import { runValidation } from "../../scripts/dev_loop/run_validation.ts"
import type { CheckCommand } from "../../scripts/dev_loop/types.ts"

const child = "tests/fixtures/validation_output_child.ts"
const checks: CheckCommand[] = repositoryHardCheckIds.map((id) => ({
  id,
  command: process.execPath,
  args: [child, id === "architecture" || id === "tests" ? "duplicate" : "pass"],
  enforcement: "hard_stop",
}))
checks.push({
  id: "source-quality-soft-limit", command: process.execPath,
  args: [child, "pass"], enforcement: "advisory",
  advisory: { rule: "source-quality-soft-limit", path: ".",
    remediate: "Refactor reported handwritten files to 120 lines or fewer" },
}, {
  id: "quality-report", command: process.execPath,
  args: [child, "pass"], enforcement: "advisory",
  advisory: { rule: "quality-report-freshness",
    path: "docs/quality-metrics.json", regenerate: "pnpm quality:generate" },
})
const receipt = runValidation({
  kind: "validation",
  checks,
  receipt_path: ".momi/full-fixture-validation-receipt.json",
})
process.exit(commandExitCode(receipt))
