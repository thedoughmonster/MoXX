import { loadWorkspace } from "./architecture/load_workspace.ts"
import { findSourceQualityFindings } from "./find_source_quality_violations.ts"
import { findPreopeningTimestampViolations } from "./find_preopening_timestamp_violations.ts"

const workspace = await loadWorkspace()
const { violations } = await findSourceQualityFindings(workspace)
violations.push(...await findPreopeningTimestampViolations())
violations.sort()

if (violations.length > 0) {
  throw new Error(`Source quality violations:\n- ${violations.join("\n- ")}`)
}

console.log("Source quality valid.")
