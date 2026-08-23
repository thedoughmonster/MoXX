import { loadWorkspace } from "./architecture/load_workspace.ts"
import { findSourceQualityFindings } from "./find_source_quality_violations.ts"

const workspace = await loadWorkspace()
const { warnings } = await findSourceQualityFindings(workspace)
const nonblocking = process.argv.includes("--nonblocking")

if (warnings.length > 0) {
  console.error(`Source quality soft-limit advisories:\n- ${warnings.join("\n- ")}`)
  if (!nonblocking) process.exitCode = 1
} else {
  console.log("Source quality soft limits valid.")
}
