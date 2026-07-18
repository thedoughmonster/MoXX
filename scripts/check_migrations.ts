import { join } from "node:path"

import { validateArchitecture } from "./architecture/validate_architecture.ts"
import { workspaceRoot } from "./architecture/paths.ts"
import { loadTargetAuthoritySnapshot } from
  "./constitution/load_target_authority_snapshot.ts"
import { findMigrationHistoryViolations } from "./migrations/find_migration_history_violations.ts"
import { findDevelopmentMigrationChangeViolations } from
  "./migrations/find_development_migration_change_violations.ts"
import { findNewMigrationAuthorityViolations } from
  "./migrations/find_new_migration_authority_violations.ts"
import { loadDevelopmentMigrationChanges } from
  "./migrations/load_development_migration_changes.ts"
import { loadDevelopmentMigrations } from
  "./migrations/load_development_migrations.ts"
import { loadLocalMigrations } from "./migrations/load_local_migrations.ts"
import { loadProductionMigrations } from "./migrations/load_production_migrations.ts"

const architecture = await validateArchitecture()
const path = architecture.workspace.paths.migrations
const current = await loadLocalMigrations(join(workspaceRoot, path))
const baseline = loadProductionMigrations(path)
const development = loadDevelopmentMigrations(path)
const serviceKeys = new Set(
  architecture.services.map((service) => service.manifest.service_key),
)
const violations = [...new Set([
  ...findMigrationHistoryViolations(baseline, current, serviceKeys),
  ...findMigrationHistoryViolations(
    development, current, serviceKeys, "development",
  ),
  ...findDevelopmentMigrationChangeViolations(
    loadDevelopmentMigrationChanges(path), path, new Set(baseline.keys()),
  ),
    ...findNewMigrationAuthorityViolations(
      development,
      current,
      architecture.services,
      loadTargetAuthoritySnapshot(),
    ),
])]
if (violations.length > 0) {
  throw new Error(`Migration violations:\n- ${violations.join("\n- ")}`)
}
console.log(`Migration history valid: ${baseline.size} production migrations.`)
