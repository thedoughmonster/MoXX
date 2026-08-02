import {
  MAX_ACTIVE_CRON_EXECUTIONS,
  MAX_PREACTIVATION_OTHER_CRON,
} from "./sample_constants.ts"
import { validateFastSample } from "./validate_fast_sample.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"
import type { WorkBaseline } from "./work_baseline_types.ts"

export function parsePreGuardWorkBaseline(value: unknown): WorkBaseline {
  const input = validateStrictRecord(
    value, ["guardPresent", "sample"], "Pre-guard work baseline input",
  )
  if (input.guardPresent !== false) throw new Error("Pre-guard baseline requires guard absence")
  const sample = validateFastSample(input.sample)
  const unsafe = [
    sample.toastRunning, sample.toastRetry, sample.toastDead,
    sample.routingRunning, sample.routingRetry, sample.routingDead,
    sample.deliveryRunning, sample.deliveryRetry, sample.deliveryDead,
    sample.queueDead, sample.expiredLeases, sample.longLeases, sample.openAttempts,
    sample.projectionReservations, sample.workerCapViolations, sample.waitingLocks,
    sample.targetExecutions, sample.targetFailures, sample.guardFailures,
    sample.guardRunCount, sample.missedSamples, sample.overlappingSamples,
  ]
  if (sample.targetJobs.some((job) => job.active) || sample.guard.active ||
    sample.activeCronExecutions > MAX_ACTIVE_CRON_EXECUTIONS ||
    sample.nonTargetNonGuardActiveExecutions > MAX_PREACTIVATION_OTHER_CRON ||
    unsafe.some((count) => count !== 0)) {
    throw new Error("Pre-guard work baseline contains unsafe activity")
  }
  return {
    toastReady: sample.toastReady,
    routingReady: sample.routingReady,
    deliveryReady: sample.deliveryReady,
    queueReady: sample.queueReady,
  }
}
