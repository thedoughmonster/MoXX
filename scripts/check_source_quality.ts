import { loadWorkspace } from "./architecture/load_workspace.ts"
import { findSourceQualityFindings } from "./find_source_quality_violations.ts"
import { findPreopeningTimestampViolations } from "./find_preopening_timestamp_violations.ts"
import { renderRepositoryDiagnostics } from
  "./diagnostics/render_repository_diagnostics.ts"
import { sourceQualityDiagnostic } from
  "./diagnostics/source_quality_diagnostic.ts"

const workspace = await loadWorkspace()
const { violationDiagnostics, violations } = await findSourceQualityFindings(workspace)
const native = await findPreopeningTimestampViolations()
violations.push(...native)

if (violations.length > 0) {
  const rendered = renderRepositoryDiagnostics(
    violationDiagnostics.map(sourceQualityDiagnostic),
  ).trimEnd()
  const remainder = native.length === 0 ? "" :
    `Unadapted violations:\n- ${native.sort().join("\n- ")}`
  throw new Error(
    `Source quality violations:\n${[rendered, remainder].filter(Boolean).join("\n")}`,
  )
}

console.log("Source quality valid.")
