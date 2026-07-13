import { join } from "node:path"

import { validateArchitecture } from "./architecture/validate_architecture.ts"
import { workspaceRoot } from "./architecture/paths.ts"
import { findMigrationHistoryViolations } from "./migrations/find_migration_history_violations.ts"
import { loadLocalMigrations } from "./migrations/load_local_migrations.ts"
import { loadProductionMigrations } from "./migrations/load_production_migrations.ts"

const architecture = await validateArchitecture()
const path = architecture.workspace.paths.migrations
const current = await loadLocalMigrations(join(workspaceRoot, path))
const baseline = loadProductionMigrations(path)
const serviceKeys = new Set(
  architecture.services.map((service) => service.manifest.service_key),
)
const violations = findMigrationHistoryViolations(baseline, current, serviceKeys)
if (violations.length > 0) {
  throw new Error(`Migration violations:\n- ${violations.join("\n- ")}`)
}
console.log(`Migration history valid: ${baseline.size} production migrations.`)
