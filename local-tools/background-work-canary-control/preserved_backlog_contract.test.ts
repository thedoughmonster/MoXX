import assert from "node:assert/strict"
import { test } from "node:test"
import { evaluateDryRunThresholds } from "./evaluate_dry_run_thresholds.ts"
import { parsePreGuardWorkBaseline } from "./parse_pre_guard_work_baseline.ts"
import { VALID_FAST_SAMPLE } from "./sample_fixtures.test_fixture.ts"
import { validateReceiptInput } from "./validate_receipt_input.ts"

test("nonzero ready backlog is baselined and equal or increased counts pass", () => {
  const preGuard = structuredClone(VALID_FAST_SAMPLE)
  preGuard.guard.active = false
  preGuard.toastReady = 44
  preGuard.routingReady = 2
  preGuard.deliveryReady = 3
  preGuard.queueReady = 4
  const baseline = parsePreGuardWorkBaseline({ guardPresent: false, sample: preGuard })
  assert.deepEqual(baseline, {
    toastReady: 44, routingReady: 2, deliveryReady: 3, queueReady: 4,
  })
  const equal = { ...VALID_FAST_SAMPLE, toastReady: 44,
    routingReady: 2, deliveryReady: 3, queueReady: 4 }
  assert.deepEqual(evaluateDryRunThresholds(equal, baseline), [])
  const increased = { ...equal, toastReady: 45,
    routingReady: 3, deliveryReady: 4, queueReady: 5 }
  assert.deepEqual(evaluateDryRunThresholds(increased, baseline), [])
})

test("any ready count below baseline has its own terminal reason", () => {
  const baseline = { toastReady: 44, routingReady: 2, deliveryReady: 3, queueReady: 4 }
  const current = { ...VALID_FAST_SAMPLE, toastReady: 44,
    routingReady: 2, deliveryReady: 3, queueReady: 4 }
  const cases = [
    ["toastReady", "toast_ready_decreased"],
    ["routingReady", "routing_ready_decreased"],
    ["deliveryReady", "delivery_ready_decreased"],
    ["queueReady", "queue_ready_decreased"],
  ] as const
  for (const [field, reason] of cases) {
    const sample = { ...current, [field]: baseline[field] - 1 }
    assert.ok(evaluateDryRunThresholds(sample, baseline).includes(reason))
  }
})

test("running, retry, dead, and queue-dead work remain terminal", () => {
  const baseline = { toastReady: 44, routingReady: 0, deliveryReady: 0, queueReady: 0 }
  const current = { ...VALID_FAST_SAMPLE, toastReady: 44 }
  const cases = [
    ["toastRunning", "toast_running"], ["toastRetry", "toast_retry"],
    ["toastDead", "toast_dead"], ["routingRunning", "routing_running"],
    ["routingRetry", "routing_retry"], ["routingDead", "routing_dead"],
    ["deliveryRunning", "delivery_running"], ["deliveryRetry", "delivery_retry"],
    ["deliveryDead", "delivery_dead"], ["queueDead", "queue_dead"],
  ] as const
  for (const [field, reason] of cases) {
    const sample = { ...current, [field]: 1 }
    assert.ok(evaluateDryRunThresholds(sample, baseline).includes(reason))
  }
})

test("baseline creation rejects every non-ready unsafe state", () => {
  const fields = [
    "toastRunning", "toastRetry", "toastDead", "routingRunning", "routingRetry",
    "routingDead", "deliveryRunning", "deliveryRetry", "deliveryDead", "queueDead",
    "expiredLeases", "longLeases", "openAttempts", "projectionReservations",
    "workerCapViolations", "waitingLocks", "targetExecutions", "targetFailures",
    "guardFailures", "guardRunCount", "missedSamples", "overlappingSamples",
  ] as const
  for (const field of fields) {
    const sample = structuredClone(VALID_FAST_SAMPLE) as any
    sample.guard.active = false
    sample[field] = 1
    assert.throws(() => parsePreGuardWorkBaseline({ guardPresent: false, sample }), /unsafe/)
  }
  const active = structuredClone(VALID_FAST_SAMPLE)
  active.guard.active = false
  active.targetJobs[0]!.active = true
  assert.throws(() => parsePreGuardWorkBaseline({ guardPresent: false, sample: active }))
  assert.throws(() => parsePreGuardWorkBaseline({
    guardPresent: true, sample: { ...VALID_FAST_SAMPLE, guard: {
      ...VALID_FAST_SAMPLE.guard, active: false,
    } },
  }), /guard absence/)
})

test("ready baseline receipt fields remain bounded and sanitized", () => {
  assert.doesNotThrow(() => validateReceiptInput({
    event_type: "work_baseline",
    timestamp_utc: "2026-08-02T01:43:09.321Z",
    metrics: { toast_ready: 44, routing_ready: 0, delivery_ready: 0, queue_ready: 0 },
  }))
})
