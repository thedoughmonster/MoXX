import { fingerprintFinding } from "./fingerprint_finding.ts"
import type {
  ConstitutionBaseline,
  ConstitutionFinding,
} from "./types.ts"

export function findBaselineViolations(
  current: ConstitutionFinding[],
  baseline: ConstitutionBaseline,
  targetBaselineFingerprints: Set<string>,
): string[] {
  const violations: string[] = []
  const baselineFingerprints = new Set<string>()
  const baselineIdentities = new Set<string>()
  for (const finding of baseline.findings) {
    const expected = fingerprintFinding(finding)
    if (!targetBaselineFingerprints.has(expected)) {
      violations.push(
        `${finding.subject}: baseline identity was not present on the trusted development ref`,
      )
    }
    if (finding.fingerprint !== expected) {
      violations.push(`${finding.subject}: baseline fingerprint must be ${expected}`)
    }
    if (baselineFingerprints.has(finding.fingerprint)) {
      violations.push(`${finding.subject}: duplicate baseline fingerprint ${finding.fingerprint}`)
    }
    if (baselineIdentities.has(expected)) {
      violations.push(`${finding.subject}: duplicate baseline finding identity ${expected}`)
    }
    baselineFingerprints.add(finding.fingerprint)
    baselineIdentities.add(expected)
  }
  const sortedBaseline = [...baseline.findings].sort((left, right) => {
    const leftKey = `${left.rule_id}\0${left.subject}\0${left.fingerprint}`
    const rightKey = `${right.rule_id}\0${right.subject}\0${right.fingerprint}`
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0
  })
  if (sortedBaseline.some((finding, index) => finding !== baseline.findings[index])) {
    violations.push("baseline findings must be sorted by rule_id, subject, and fingerprint")
  }
  const currentFingerprints = new Set<string>()
  for (const finding of current) {
    if (currentFingerprints.has(finding.fingerprint)) {
      violations.push(
        `${finding.subject}: duplicate current finding identity ${finding.fingerprint}`,
      )
    }
    currentFingerprints.add(finding.fingerprint)
  }
  for (const finding of current) {
    if (!baselineIdentities.has(finding.fingerprint)) {
      violations.push(
        `new ${finding.rule_id}: ${finding.subject}: ${finding.summary} (${finding.fingerprint})`,
      )
    }
  }
  for (const finding of baseline.findings) {
    const identity = fingerprintFinding(finding)
    if (!currentFingerprints.has(identity)) {
      violations.push(
        `stale baseline ${finding.rule_id}: ${finding.subject} (${identity})`,
      )
    }
  }
  return violations
}
