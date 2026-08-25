import type { CheckEnforcement } from "../dev_loop/check_types.ts"
import type { RepositoryDiagnosticV1 } from "./types.ts"

export function catalogDiagnostic(
  enforcement: CheckEnforcement,
): RepositoryDiagnosticV1 {
  return {
    schema_version: 1,
    rule_id: "catalog",
    enforcement,
    location: { path: "docs/service-catalog.md" },
    violated_rule: "The generated service catalog must match current service and function manifests.",
    expected: "Regenerate docs/service-catalog.md from the authoritative manifests.",
    repair: { kind: "command", command: "pnpm catalog:generate" },
    validation_command: "pnpm catalog:check",
    fingerprint: {
      group: { rule_id: "catalog" },
      instance: { artifact: "docs/service-catalog.md" },
    },
  }
}
