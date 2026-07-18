import assert from "node:assert/strict"
import { join } from "node:path"
import test from "node:test"

import { validateArchitecture } from "../scripts/architecture/validate_architecture.ts"
import { workspaceRoot } from "../scripts/architecture/paths.ts"
import { buildDatabaseSourceModules } from
  "../scripts/constitution/build_database_source_modules.ts"
import { findRuntimeAccessFindings } from
  "../scripts/constitution/find_runtime_access_findings.ts"
import { replayRelationDefinitions } from
  "../scripts/constitution/replay_relation_definitions.ts"
import { replayRoutineDefinitions } from
  "../scripts/constitution/replay_routine_definitions.ts"
import { loadLocalMigrations } from
  "../scripts/migrations/load_local_migrations.ts"

test("ratchets active migration-defined routine and view bodies", async () => {
  const architecture = await validateArchitecture()
  const migrations = await loadLocalMigrations(join(
    workspaceRoot,
    architecture.workspace.paths.migrations,
  ))
  const modules = buildDatabaseSourceModules(
    architecture.services,
    replayRelationDefinitions(migrations),
    replayRoutineDefinitions(migrations),
  )
  const findings = findRuntimeAccessFindings(architecture.services, modules)
  assert.ok(findings.some((finding) =>
    finding.subject.startsWith(
      "database/routines/momi_communications.capture_openai_message_v1--",
    ) &&
    finding.evidence.relation === "momi_communications.evaluation_jobs"
  ))
  assert.ok(findings.some((finding) =>
    finding.subject ===
      "database/views/momi_alerting.slack_order_alert_messages_v1.sql" &&
    finding.evidence.relation === "momi_alerting.order_alert_candidates"
  ))
})
