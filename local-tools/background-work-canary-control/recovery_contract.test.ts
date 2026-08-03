import assert from "node:assert/strict"
import test from "node:test"

import { DEV_PROJECT_REF } from "./constants.ts"
import { DRAIN_LIMIT_MS, FAST_INTERVAL_MS, HARD_LIMIT_MS,
  PROGRESS_LIMIT_MS, RESOURCE_INTERVAL_MS } from "./recovery_constants.ts"
import { generateRecoveryCleanupSql } from "./generate_recovery_cleanup_sql.ts"
import { buildRecoveryControlInput } from "./build_recovery_control_input.ts"
import { generateRecoveryPreflightSql } from "./generate_recovery_preflight_sql.ts"
import { parsePublicInvocation } from "./parse_public_invocation.ts"
import { validateDeadmanActiveMasks } from "./validate_deadman_active_masks.ts"

test("recovery public invocation accepts only the fixed development scope", () => {
  assert.deepEqual(parsePublicInvocation(["--env", "dev", "--project-ref", DEV_PROJECT_REF]),
    { environment: "dev", projectRef: DEV_PROJECT_REF })
  for (const args of [["--env", "prod", "--project-ref", DEV_PROJECT_REF],
    ["--env", "dev", "--project-ref", DEV_PROJECT_REF, "--target", "3"],
    ["--env", "dev"]]) assert.throws(() => parsePublicInvocation(args))
})

test("recovery timing and dead-man masks are fixed", () => {
  assert.equal(FAST_INTERVAL_MS, 15_000)
  assert.equal(RESOURCE_INTERVAL_MS, 60_000)
  assert.equal(PROGRESS_LIMIT_MS, 120_000)
  assert.equal(DRAIN_LIMIT_MS, 3_600_000)
  assert.equal(HARD_LIMIT_MS, 4_140_000)
  assert.deepEqual(validateDeadmanActiveMasks([0, 11]), [0, 11])
  assert.throws(() => validateDeadmanActiveMasks([16]))
})

test("dynamic preflight authenticates schedule contracts without a fixed backlog count", () => {
  const sql = generateRecoveryPreflightSql()
  assert.match(sql, /idempotency_key like a\.schedule_key \|\| ':%'/)
  assert.match(sql, /operation_enabled is true and a\.source_enabled is true/)
  assert.match(sql, /registryContractViolations/)
  assert.match(sql, /left join toast_acquisition\.operations/)
  assert.match(sql, /registrySha256/)
  assert.doesNotMatch(sql, /2026-08-03 00:00|62|74|117/)
})

test("cleanup remains exact, supported, and idempotent for an absent guard", () => {
  const runtime = { options: { environment: "dev", projectRef: DEV_PROJECT_REF },
    repository: { nodeVersion: "24.14.0", pnpmVersion: "11.7.0",
      supabaseCliVersion: "2.109.1", branch: "dev", headSha: "d".repeat(40),
      projectRef: DEV_PROJECT_REF } } as never
  const sql = generateRecoveryCleanupSql(buildRecoveryControlInput(runtime, 20),
    "run-0123456789abcdef01234567", "a".repeat(64), false)
  assert.match(sql, /cron\.unschedule/)
  assert.doesNotMatch(sql, /update cron\.job/)
  assert.match(sql, /guard_name_count = 0 and guard_id_count = 0/)
  assert.match(sql, /momi_recovery_cleanup_generation/)
})
