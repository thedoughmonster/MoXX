import { commandExitCode } from "./dev_loop/command_exit_code.ts"
import { runValidation } from "./dev_loop/run_validation.ts"
import { readOption } from "./read_option.ts"

const service = readOption("service", "all")
const receipt = runValidation({
  kind: "validation",
  receipt_path: readOption("receipt", ".momi/test-receipt.json"),
  checks: [{
    id: service === "all" ? "tests" : `tests-${service}`,
    command: process.execPath,
    args: ["scripts/run_discovered_tests.ts", "--service", service],
    enforcement: "hard_stop",
  }],
})
process.exit(commandExitCode(receipt))
