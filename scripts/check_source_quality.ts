import { loadWorkspace } from "./architecture/load_workspace.ts"
import { findSourceQualityViolations } from "./find_source_quality_violations.ts"

const workspace = await loadWorkspace()
const violations = await findSourceQualityViolations(workspace)

if (violations.length > 0) {
  throw new Error(`Source quality violations:\n- ${violations.join("\n- ")}`)
}

console.log("Source quality valid.")
