import { canonicalGeneratorIdentity } from
  "../codex_hooks/canonical_generator_identity.ts"
import type { CanonicalArtifactGenerator } from "../codex_hooks/types.ts"
import type { CheckEnforcement } from "../dev_loop/check_types.ts"
import type { RepositoryDiagnosticV1 } from "./types.ts"

export function generatedArtifactDiagnostic(
  kind: CanonicalArtifactGenerator,
  condition: "freshness" | "validity",
  enforcement: CheckEnforcement,
  detail?: string,
  safeRepair = true,
): RepositoryDiagnosticV1 {
  const identity = canonicalGeneratorIdentity(kind)
  const artifact = kind === "catalog" ? "service catalog" : "quality report"
  const ruleId = kind === "catalog" && condition === "freshness"
    ? "catalog"
    : kind === "quality" && condition === "freshness"
    ? "quality-report-freshness"
    : `GENERATED_${kind === "catalog" ? "SERVICE_CATALOG" :
      "QUALITY_REPORT"}_${condition.toUpperCase()}`
  return {
    schema_version: 1,
    rule_id: ruleId,
    enforcement,
    location: { path: identity.path },
    violated_rule: condition === "freshness"
      ? `The generated ${artifact} must match current repository sources.`
      : `The generated ${artifact} must be readable and satisfy its owned format.`,
    ...(detail ? { rationale: `Reported condition: ${detail}` } : {}),
    expected: safeRepair
      ? `Regenerate the ${artifact} with its canonical generator.`
      : `Restore the ${artifact} to a readable repository state, then validate it.`,
    repair: safeRepair
      ? { kind: "command", command: identity.command }
      : { kind: "none" },
    validation_command: identity.validation_command,
    fingerprint: {
      group: { rule_id: ruleId, generator: kind, condition },
      instance: { artifact: identity.path },
    },
  }
}
