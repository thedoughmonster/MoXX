import { acquireReleaseLock } from "./release/acquire_release_lock.ts"
import { parseReleaseEnvironment } from "./release/parse_release_environment.ts"
import { parseRetirementSelection } from "./deploy/parse_retirement_selection.ts"
import { releaseDev } from "./release/release_dev.ts"
import { releaseProd } from "./release/release_prod.ts"
import { releaseReleaseLock } from "./release/release_release_lock.ts"
import { readOption } from "./read_option.ts"

const environment = parseReleaseEnvironment()
if (!process.versions.node.startsWith("24.")) {
  throw new Error(`Node 24 is required; found ${process.versions.node}`)
}
acquireReleaseLock(environment)
try {
  if (environment === "dev") {
    const receipt = readOption("validation-receipt", "")
    if (!receipt) throw new Error("--validation-receipt is required")
    const retirements = parseRetirementSelection(readOption("retire-functions", ""))
    await releaseDev(receipt, retirements)
  } else {
    const receipt = readOption("dev-receipt", "")
    if (!receipt) throw new Error("--dev-receipt is required")
    await releaseProd(receipt)
  }
} finally {
  releaseReleaseLock()
}
