import { commandExitCode } from "../../scripts/dev_loop/command_exit_code.ts"
import { runValidation } from "../../scripts/dev_loop/run_validation.ts"

process.stdout.write("outer-stdout-before\n")
process.stderr.write("outer-stderr-before\n")
const nested = runValidation({
  kind: "validation",
  checks: [{ id: "tests", command: process.execPath,
    args: ["-e", "process.stdout.write('nested tests evidence')"],
    enforcement: "hard_stop" }],
  receipt_path: ".momi/nested-validation-receipt.json",
})
process.stdout.write("outer-stdout-after\n")
process.stderr.write("outer-stderr-after\n")
process.exit(commandExitCode(nested))
