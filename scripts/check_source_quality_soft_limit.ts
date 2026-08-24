import { loadWorkspace } from "./architecture/load_workspace.ts"
import { findSourceQualityFindings } from "./find_source_quality_violations.ts"
import { renderRepositoryDiagnostics } from
  "./diagnostics/render_repository_diagnostics.ts"
import { sourceQualityDiagnostic } from
  "./diagnostics/source_quality_diagnostic.ts"

const workspace = await loadWorkspace()
const findings = await findSourceQualityFindings(workspace)
const nonblocking = process.argv.includes("--nonblocking")

if (findings.warnings.length > 0) {
  console.error(
    "Source quality soft-limit advisories:\n" + renderRepositoryDiagnostics(
      findings.warningDiagnostics.map(sourceQualityDiagnostic),
    ).trimEnd(),
  )
  if (!nonblocking) process.exitCode = 1
} else {
  console.log("Source quality soft limits valid.")
}
