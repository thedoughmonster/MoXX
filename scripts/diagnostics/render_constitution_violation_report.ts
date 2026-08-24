import type { LoadedService } from "../architecture/types.ts"
import type { ConstitutionFinding } from "../constitution/types.ts"
import { constitutionDiagnostic } from "./constitution_diagnostic.ts"
import { renderRepositoryDiagnostics } from "./render_repository_diagnostics.ts"

export function renderConstitutionViolationReport(
  violations: string[],
  findings: ConstitutionFinding[],
  services: LoadedService[],
): string {
  const adapted = findings.map((finding) => {
    const violation = `new ${finding.rule_id}: ${finding.subject}: ` +
      `${finding.summary} (${finding.fingerprint})`
    return {
      diagnostic: violations.includes(violation)
        ? constitutionDiagnostic(finding, services)
        : null,
      violation,
    }
  }).filter((item) => item.diagnostic !== null)
  const adaptedViolations = new Set(adapted.map((item) => item.violation))
  const native = violations.filter((violation) =>
    !adaptedViolations.has(violation)
  )
  const rendered = renderRepositoryDiagnostics(
    adapted.map((item) => item.diagnostic!),
  ).trimEnd()
  const remainder = native.length === 0 ? "" :
    `Unadapted violations:\n- ${native.join("\n- ")}`
  return [rendered, remainder].filter(Boolean).join("\n")
}
