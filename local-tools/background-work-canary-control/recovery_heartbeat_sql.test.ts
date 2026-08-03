import assert from "node:assert/strict"
import test from "node:test"

import { buildCombinedHeartbeatInput } from "./build_combined_heartbeat_input.ts"
import { createRecoverySnapshotFixture } from "./create_recovery_snapshot.test_fixture.ts"
import { generateGuardHeartbeatSql } from "./generate_guard_heartbeat_sql.ts"
import { generateRecoveryObservationSql } from "./generate_recovery_observation_sql.ts"
import { DEV_PROJECT_REF } from "./constants.ts"

test("recovery heartbeat keeps generation and lease fences while allowing exact targets", () => {
  const runtime = { options: { env: "dev", projectRef: DEV_PROJECT_REF } } as never
  const input = buildCombinedHeartbeatInput(runtime, "run-0123456789abcdef01234567", 20,
    "a".repeat(64), "b".repeat(64), 100, false)
  const { includeResource: _resource, ...heartbeat } = input
  const inactive = generateGuardHeartbeatSql(heartbeat)
  const recovery = generateRecoveryObservationSql(heartbeat, {
    startedAtUtcMs: 1_785_752_000_000, frozen: createRecoverySnapshotFixture(),
    targetJobs: createRecoverySnapshotFixture().targetJobs, guardJobId: 20,
    generationSha256: "a".repeat(64), guardCommandSha256: "c".repeat(64),
  }, false)
  assert.match(inactive, /momi_guard_heartbeat_target_active/)
  assert.match(inactive, /momi_guard_heartbeat_target_running/)
  assert.doesNotMatch(recovery, /momi_guard_heartbeat_target_active/)
  assert.doesNotMatch(recovery, /momi_guard_heartbeat_target_running/)
  assert.match(recovery, /active <> \(jobid in \(2, 3, 11\)\)/)
  assert.match(recovery, /momi_guard_heartbeat_current_command/)
  assert.match(recovery, /momi_guard_heartbeat_expired/)
  assert.match(recovery, /dueAtStartRemaining/)
  assert.match(recovery, /invalidTargetReturns/)
  assert.doesNotMatch(recovery, /pg_ls_waldir/)
  const resource = generateRecoveryObservationSql(heartbeat, {
    startedAtUtcMs: 1_785_752_000_000, frozen: createRecoverySnapshotFixture(),
    targetJobs: createRecoverySnapshotFixture().targetJobs, guardJobId: 20,
    generationSha256: "a".repeat(64), guardCommandSha256: "c".repeat(64),
  }, true)
  assert.match(resource, /pg_ls_waldir/)
})
