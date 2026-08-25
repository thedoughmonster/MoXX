import type { SourceQualityDiagnostic } from "../source_quality_types.ts"
import type { RepositoryDiagnosticV1 } from "./types.ts"

export function sourceQualityDiagnostic(
  finding: SourceQualityDiagnostic,
): RepositoryDiagnosticV1 {
  const expected = finding.code === "SOURCE_HANDWRITTEN_LINE_LIMIT"
    ? `Reduce each affected file to ${finding.limit} lines or fewer without changing behavior.`
    : finding.code === "SOURCE_MULTIPLE_TOP_LEVEL_FUNCTIONS"
    ? "Split each affected file so it declares at most one top-level function."
    : "Correct the reported TypeScript syntax at every affected location."
  const violatedRule = finding.code === "SOURCE_HANDWRITTEN_LINE_LIMIT"
    ? "Handwritten non-SQL files must remain within the configured line limit."
    : finding.code === "SOURCE_MULTIPLE_TOP_LEVEL_FUNCTIONS"
    ? "Each TypeScript file may declare at most one top-level function."
    : "Repository TypeScript sources must parse successfully."
  const rationale = finding.code === "SOURCE_TYPESCRIPT_PARSE_FAILURE"
    ? finding.message.startsWith(`${finding.path}: `)
      ? finding.message.slice(finding.path.length + 2, finding.path.length + 502)
      : finding.message.slice(0, 500)
    : undefined
  return {
    schema_version: 1,
    rule_id: finding.code,
    enforcement: finding.severity === "advisory" ? "advisory" : "hard_stop",
    location: {
      path: finding.path,
      ...(finding.line === undefined ? {} : { line: finding.line }),
      ...(finding.column === undefined ? {} : { column: finding.column }),
    },
    violated_rule: violatedRule,
    ...(rationale === undefined ? {} : { rationale }),
    expected,
    repair: { kind: "none" },
    validation_command: finding.severity === "advisory"
      ? "node scripts/check_source_quality_soft_limit.ts"
      : "node scripts/check_source_quality.ts",
    fingerprint: {
      group: {
        rule_id: finding.code,
        ...(finding.limit === undefined ? {} : { limit: finding.limit }),
      },
      instance: {
        path: finding.path,
        ...(finding.line === undefined ? {} : { line: finding.line }),
        ...(finding.column === undefined ? {} : { column: finding.column }),
      },
    },
  }
}
