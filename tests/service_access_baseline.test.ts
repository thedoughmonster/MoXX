import assert from "node:assert/strict"
import { join } from "node:path"
import test from "node:test"

import { workspaceRoot } from "../scripts/architecture/paths.ts"
import { validateArchitecture } from "../scripts/architecture/validate_architecture.ts"
import { buildDatabaseSourceModules } from
  "../scripts/constitution/build_database_source_modules.ts"
import { findBaselineViolations } from
  "../scripts/constitution/find_baseline_violations.ts"
import { findRuntimeAccessFindings } from
  "../scripts/constitution/find_runtime_access_findings.ts"
import { fingerprintFinding } from
  "../scripts/constitution/fingerprint_finding.ts"
import { loadAccessBaseline } from
  "../scripts/constitution/load_access_baseline.ts"
import { loadTargetAccessBaselineFingerprints } from
  "../scripts/constitution/load_target_access_baseline_fingerprints.ts"
import { replayRelationDefinitions } from
  "../scripts/constitution/replay_relation_definitions.ts"
import { replayRoutineDefinitions } from
  "../scripts/constitution/replay_routine_definitions.ts"
import { loadLocalMigrations } from
  "../scripts/migrations/load_local_migrations.ts"

const architecture = await validateArchitecture()
const accessBaseline = await loadAccessBaseline()
const migrations = await loadLocalMigrations(join(
  workspaceRoot,
  architecture.workspace.paths.migrations,
))
const databaseModules = buildDatabaseSourceModules(
  architecture.services,
  replayRelationDefinitions(migrations),
  replayRoutineDefinitions(migrations),
)

test("matches the exact removal-only runtime access baseline", async () => {
  const findings = findRuntimeAccessFindings(
    architecture.services,
    [...architecture.modules, ...databaseModules],
  )
  const baseline = structuredClone(accessBaseline)
  const target = loadTargetAccessBaselineFingerprints()
  assert.equal(findings.length, 97)
  assert.equal(
    findings.filter((item) => item.rule_id === "direct_private_relation_access")
      .length,
    95,
  )
  assert.equal(
    findings.filter((item) => item.rule_id === "direct_private_routine_call")
      .length,
    1,
  )
  assert.equal(
    findings.filter((item) => item.rule_id === "dynamic_event_name").length,
    0,
  )
  assert.equal(
    findings.filter((item) => item.rule_id === "dynamic_relation_identifier")
      .length,
    1,
  )
  assert.deepEqual(findBaselineViolations(findings, baseline, target), [])
})

test("pins bootstrap identities independently of the candidate baseline", async () => {
  const baseline = structuredClone(accessBaseline)
  const changed = structuredClone(baseline)
  changed.findings[0].evidence.relation = "momi_runtime.new_private_relation"
  changed.findings[0].fingerprint = fingerprintFinding(changed.findings[0])
  const violations = findBaselineViolations(
    changed.findings,
    changed,
    loadTargetAccessBaselineFingerprints(),
  )
  assert.ok(violations.some((item) => item.includes("identity was not present")))
})

test("discovers service-root runtime modules", async () => {
  const paths = architecture.modules.map((module) =>
    module.path.replaceAll("\\", "/")
  )
  assert.ok(paths.some((path) =>
    path.endsWith("services/warehouse-read-api/src/read_entity.ts")
  ))
  assert.equal(new Set(paths).size, paths.length)
})
