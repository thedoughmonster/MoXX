import { buildRepositoryChecks } from "./dev_loop/build_repository_checks.ts"
import { commandExitCode } from "./dev_loop/command_exit_code.ts"
import { runValidation } from "./dev_loop/run_validation.ts"
import { readOption } from "./read_option.ts"

const service = readOption("service", "all")
const receiptPath = readOption("receipt", ".momi/repository-validation-receipt.json")
const receipt = runValidation({
  kind: "validation",
  checks: await buildRepositoryChecks(service, true),
  receipt_path: receiptPath,
})
process.exit(commandExitCode(receipt))
