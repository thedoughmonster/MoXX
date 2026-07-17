import { validateArchitecture } from "./architecture/validate_architecture.ts"
import { findBaselineViolations } from
  "./constitution/find_baseline_violations.ts"
import { findServiceConstitutionFindings } from
  "./constitution/find_service_constitution_findings.ts"
import { loadConstitutionBaseline } from
  "./constitution/load_constitution_baseline.ts"
import { loadTargetBaselineFingerprints } from
  "./constitution/load_target_baseline_fingerprints.ts"

const architecture = await validateArchitecture()
const findings = findServiceConstitutionFindings(architecture.services)
const baseline = await loadConstitutionBaseline()
const violations = findBaselineViolations(
  findings,
  baseline,
  loadTargetBaselineFingerprints(),
)

if (violations.length > 0) {
  throw new Error(`Service constitution violations:\n- ${violations.join("\n- ")}`)
}

console.log(`Service constitution valid: ${findings.length} exact baselined findings.`)
for (const finding of findings) {
  console.log(
    `- ${finding.rule_id}@${finding.rule_version} ${finding.subject} ` +
      `${finding.fingerprint}: ${finding.summary}`,
  )
}
