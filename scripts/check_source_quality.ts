import { loadWorkspace } from "./architecture/load_workspace.ts"
import { findSourceQualityFindings } from "./find_source_quality_violations.ts"

const workspace = await loadWorkspace()
const { warnings, violations } = await findSourceQualityFindings(workspace)

if (warnings.length > 0) {
  console.warn(`Source quality warnings:\n- ${warnings.join("\n- ")}`)
}

if (violations.length > 0) {
  throw new Error(`Source quality violations:\n- ${violations.join("\n- ")}`)
}

console.log("Source quality valid.")
