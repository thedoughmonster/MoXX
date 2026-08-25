import { fingerprintFinding } from "./fingerprint_finding.ts"
import type {
  ConstitutionFinding,
  ConstitutionFindingInput,
} from "./types.ts"

export function finalizeFindings(
  findings: ConstitutionFindingInput[],
): ConstitutionFinding[] {
  return findings.map((finding) => ({
    ...finding,
    fingerprint: fingerprintFinding(finding),
  })).sort((left, right) => {
    const leftKey = `${left.rule_id}\0${left.subject}\0${left.fingerprint}`
    const rightKey = `${right.rule_id}\0${right.subject}\0${right.fingerprint}`
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0
  })
}
