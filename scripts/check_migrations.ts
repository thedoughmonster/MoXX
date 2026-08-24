import { join } from "node:path"

import { validateArchitecture } from "./architecture/validate_architecture.ts"
import { workspaceRoot } from "./architecture/paths.ts"
import { loadTargetAuthoritySnapshot } from
  "./constitution/load_target_authority_snapshot.ts"
import type { MigrationDiagnosticPhase } from
  "./diagnostics/classify_migration_violation.ts"
import { migrationViolationDiagnostic } from
  "./diagnostics/migration_violation_diagnostic.ts"
import { renderMigrationViolations } from
  "./diagnostics/render_migration_violations.ts"
import { renderRepositoryDiagnostics } from
  "./diagnostics/render_repository_diagnostics.ts"
import { findMigrationHistoryViolations } from "./migrations/find_migration_history_violations.ts"
import { findDevelopmentMigrationChangeViolations } from
  "./migrations/find_development_migration_change_violations.ts"
import { findNewMigrationAuthorityViolations } from
  "./migrations/find_new_migration_authority_violations.ts"
import { loadDevelopmentMigrationChanges } from
  "./migrations/load_development_migration_changes.ts"
import { loadDevelopmentMigrations } from
  "./migrations/load_development_migrations.ts"
import { loadDevelopmentMigrationCorrections } from
  "./migrations/load_development_migration_corrections.ts"
import { loadLocalMigrations } from "./migrations/load_local_migrations.ts"
import { loadProductionMigrations } from "./migrations/load_production_migrations.ts"

const architecture = await validateArchitecture()
const path = architecture.workspace.paths.migrations
let baselineCount = 0
let phase: MigrationDiagnosticPhase = "inventory"
let violations: string[] = []
try {
  const current = await loadLocalMigrations(join(workspaceRoot, path))
  phase = "production_baseline"
  const baseline = loadProductionMigrations(path)
  phase = "development_baseline"
  const development = loadDevelopmentMigrations(path)
  phase = "correction_ledger"
  const corrections = loadDevelopmentMigrationCorrections()
  const renameCorrections = new Map([...corrections]
    .filter(([, correction]) => correction.replacement)
  )
  const contentCorrections = new Set([...corrections]
    .filter(([, correction]) => !correction.replacement)
    .map(([name]) => name))
  const serviceKeys = new Set(
    architecture.services.map((service) => service.manifest.service_key),
  )
  phase = "development_history"
  const developmentChanges = loadDevelopmentMigrationChanges(path)
  phase = "authority_snapshot"
  const authoritySnapshot = loadTargetAuthoritySnapshot()
  phase = "authority_validation"
  violations = [...new Set([
    ...findMigrationHistoryViolations(baseline, current, serviceKeys),
    ...findMigrationHistoryViolations(
      development, current, serviceKeys, "development", corrections,
    ),
    ...findDevelopmentMigrationChangeViolations(
      developmentChanges, path, new Set(baseline.keys()),
      contentCorrections, renameCorrections,
    ),
    ...findNewMigrationAuthorityViolations(
      development,
      current,
      architecture.services,
      authoritySnapshot,
    ),
  ])]
  baselineCount = baseline.size
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error)
  const diagnostic = migrationViolationDiagnostic(detail, path, phase)
  if (diagnostic.rule_id === "MIGRATION_VALIDATION_FAILURE") throw error
  throw new Error(renderRepositoryDiagnostics([diagnostic]).trimEnd())
}
if (violations.length > 0) {
  throw new Error(renderMigrationViolations(violations, path))
}
console.log(`Migration history valid: ${baselineCount} production migrations.`)
