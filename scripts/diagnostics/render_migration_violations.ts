import { migrationViolationDiagnostic } from
  "./migration_violation_diagnostic.ts"
import { renderRepositoryDiagnostics } from
  "./render_repository_diagnostics.ts"

export function renderMigrationViolations(
  violations: readonly string[],
  migrationPath: string,
): string {
  const diagnostics = violations.map((violation) =>
    migrationViolationDiagnostic(violation, migrationPath)
  )
  return diagnostics.some((item) => item.rule_id === "MIGRATION_VALIDATION_FAILURE")
    ? `Migration violations:\n- ${violations.join("\n- ")}`
    : renderRepositoryDiagnostics(diagnostics).trimEnd()
}
