import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { workspaceRoot } from "./architecture/paths.ts"
import { validateArchitecture } from "./architecture/validate_architecture.ts"
import { findBaselineViolations } from
  "./constitution/find_baseline_violations.ts"
import { findServiceConstitutionFindings } from
  "./constitution/find_service_constitution_findings.ts"
import { findRuntimeAccessFindings } from
  "./constitution/find_runtime_access_findings.ts"
import { buildDatabaseSourceModules } from
  "./constitution/build_database_source_modules.ts"
import { loadAccessBaseline } from
  "./constitution/load_access_baseline.ts"
import { checkCurrentLegacyAccessGovernanceReport } from
  "./constitution/check_current_legacy_access_governance_report.ts"
import { loadConstitutionBaseline } from
  "./constitution/load_constitution_baseline.ts"
import { loadTargetBaselineFingerprints } from
  "./constitution/load_target_baseline_fingerprints.ts"
import { loadTargetAccessBaselineFingerprints } from
  "./constitution/load_target_access_baseline_fingerprints.ts"
import { buildDebtLifecycleTrend } from
  "./constitution/build_debt_lifecycle_trend.ts"
import { findDebtLifecycleViolations } from
  "./constitution/find_debt_lifecycle_violations.ts"
import { loadDebtLifecycleRegistry } from
  "./constitution/load_debt_lifecycle_registry.ts"
import { loadTargetDebtLifecycleRegistry } from
  "./constitution/load_target_debt_lifecycle_registry.ts"
import { renderDebtLifecycleTrend } from
  "./constitution/render_debt_lifecycle_trend.ts"
import { replayRelationInventory } from
  "./constitution/replay_relation_inventory.ts"
import { replayRelationDefinitions } from
  "./constitution/replay_relation_definitions.ts"
import { replayRoutineInventory } from
  "./constitution/replay_routine_inventory.ts"
import { replayRoutineDefinitions } from
  "./constitution/replay_routine_definitions.ts"
import { loadLocalMigrations } from "./migrations/load_local_migrations.ts"

const architecture = await validateArchitecture()
const migrations = await loadLocalMigrations(join(
  workspaceRoot,
  architecture.workspace.paths.migrations,
))
const relations = replayRelationInventory(migrations)
const routines = replayRoutineInventory(migrations)
const databaseModules = buildDatabaseSourceModules(
  architecture.services,
  replayRelationDefinitions(migrations),
  replayRoutineDefinitions(migrations),
)
const findings = findServiceConstitutionFindings(
  architecture.services,
  relations,
  routines,
)
const baseline = await loadConstitutionBaseline()
const declarationViolations = findBaselineViolations(
  findings,
  baseline,
  loadTargetBaselineFingerprints(),
)
const accessFindings = findRuntimeAccessFindings(
  architecture.services,
  [...architecture.modules, ...databaseModules],
)
const accessBaseline = await loadAccessBaseline()
await checkCurrentLegacyAccessGovernanceReport()
const accessViolations = findBaselineViolations(
  accessFindings,
  accessBaseline,
  loadTargetAccessBaselineFingerprints(),
)
const registry = await loadDebtLifecycleRegistry()
const lifecycleFindings = [...baseline.findings, ...accessBaseline.findings]
const lifecycleViolations = findDebtLifecycleViolations(
  lifecycleFindings,
  registry,
  loadTargetDebtLifecycleRegistry(),
)
const expectedTrend = renderDebtLifecycleTrend(
  buildDebtLifecycleTrend(lifecycleFindings, registry),
)
const actualTrend = await readFile(join(
  workspaceRoot,
  "docs",
  "debt-lifecycle-trend.json",
), "utf8")
if (actualTrend.replaceAll("\r\n", "\n") !== expectedTrend) {
  lifecycleViolations.push(
    "debt lifecycle trend is stale; run pnpm debt-lifecycle:generate",
  )
}
const violations = [
  ...declarationViolations,
  ...accessViolations,
  ...lifecycleViolations,
]

if (violations.length > 0) {
  throw new Error(`Service constitution violations:\n- ${violations.join("\n- ")}`)
}

console.log(
  `Service constitution declarations valid: ${findings.length} exact baselined findings.`,
)
console.log(`Runtime access ratchet valid: ${accessFindings.length} exact findings.`)
console.log(`Debt lifecycle registry valid: ${lifecycleFindings.length} exact findings.`)
for (const finding of findings) {
  console.log(
    `- ${finding.rule_id}@${finding.rule_version} ${finding.subject} ` +
      `${finding.fingerprint}: ${finding.summary}`,
  )
}
