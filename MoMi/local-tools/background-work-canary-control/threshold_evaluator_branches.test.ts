import assert from "node:assert/strict"
import test from "node:test"

import { evaluateDryRunThresholds } from "./evaluate_dry_run_thresholds.ts"
import {
  VALID_FAST_SAMPLE,
  VALID_RESOURCE_SAMPLE,
} from "./sample_fixtures.test_fixture.ts"
import { VALID_WORK_BASELINE } from "./work_baseline.test_fixture.ts"

test("every accepted work and resource counter independently stops the dry run", () => {
  const workGroups = [
    ["toast_running", ["toastRunning"]],
    ["toast_retry", ["toastRetry"]],
    ["toast_dead", ["toastDead"]],
    ["routing_running", ["routingRunning"]],
    ["routing_retry", ["routingRetry"]],
    ["routing_dead", ["routingDead"]],
    ["delivery_running", ["deliveryRunning"]],
    ["delivery_retry", ["deliveryRetry"]],
    ["delivery_dead", ["deliveryDead"]],
    ["queue_dead", ["queueDead"]],
    ["lease_work_present", ["expiredLeases", "longLeases"]],
  ] as const
  for (const [reason, fields] of workGroups) {
    for (const field of fields) {
      const fast = structuredClone(VALID_FAST_SAMPLE) as any
      fast[field] = 1
      assert.ok(evaluateDryRunThresholds(
        fast, VALID_WORK_BASELINE,
      ).includes(reason), `${reason}:${field}`)
    }
  }

  const resourceBreaches = [
    ["active_cron_limit_exceeded", "activeCronExecutions", 9],
    ["target_failure_detected", "targetRunFailures", 1],
    ["guard_failure_detected", "guardRunFailures", 1],
    ["waiting_lock_detected", "waitingLocks", 1],
  ] as const
  for (const [reason, field, value] of resourceBreaches) {
    const resource = structuredClone(VALID_RESOURCE_SAMPLE) as any
    resource[field] = value
    assert.ok(
      evaluateDryRunThresholds(
        VALID_FAST_SAMPLE, VALID_WORK_BASELINE, resource,
      ).includes(reason),
      `${reason}:${field}`,
    )
  }
})
