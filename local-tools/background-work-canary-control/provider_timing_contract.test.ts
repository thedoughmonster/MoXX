import assert from "node:assert/strict"
import { test } from "node:test"
import { DEADMAN_EXPIRY_SQL_EXPRESSION } from "./deadman_command_constants.ts"
import type { DeadmanPhaseHandoff } from "./deadman_phase_types.ts"
import { deriveDeadmanDeadline } from "./derive_deadman_deadline.ts"
import { CHILD_HARD_TIMEOUT_MS } from "./process_constants.ts"
import { FAST_SAMPLE_INTERVAL_SECONDS, LIFECYCLE_DEADLINE_MS,
  PROVIDER_DEADLINE_MS } from "./schedule_constants.ts"

test("direct provider startup preserves every accepted timing bound", () => {
  assert.equal(CHILD_HARD_TIMEOUT_MS, 10_000)
  assert.equal(PROVIDER_DEADLINE_MS, 10_000)
  assert.equal(LIFECYCLE_DEADLINE_MS, 12_000)
  assert.equal(FAST_SAMPLE_INTERVAL_SECONDS, 15)
  assert.equal(DEADMAN_EXPIRY_SQL_EXPRESSION,
    "clock_timestamp() + interval '30 seconds'")
  assert.equal(deriveDeadmanDeadline({
    status: "bootstrap_ambiguous_deadman_fallback_pending",
    bootstrapTerminalUtcMs: 1_000,
  } as DeadmanPhaseHandoff), 36_000)
  assert.equal(deriveDeadmanDeadline({
    status: "sampling_failed_deadman_fallback_pending",
    lastObservedAtUtcMs: 1_000,
  } as DeadmanPhaseHandoff), 36_000)
})
