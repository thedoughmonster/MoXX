import type { ResourceBaseline } from "./query_payload_types.ts"
import type { ResourceSample } from "./sample_types.ts"
import { GUARD_CRON_HISTORY_ESTIMATED_BYTES_PER_ROW } from "./sample_constants.ts"
import { parseResourceQueryPayload } from "./parse_resource_query_payload.ts"
import { validateNonnegativeInteger } from "./validate_nonnegative_integer.ts"
import { validateResourceSample } from "./validate_resource_sample.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"

export function parseResourceQueryOutput(
  output: Uint8Array,
  baselineValue: unknown,
): ResourceSample {
  const baseline = validateStrictRecord(
    baselineValue, ["maxCronRunId", "databaseBytes", "cronHistoryBytes", "deadlocks"],
    "Resource baseline",
  ) as ResourceBaseline
  for (const key of [
    "maxCronRunId", "databaseBytes", "cronHistoryBytes", "deadlocks",
  ] as const) {
    validateNonnegativeInteger(baseline[key], `Resource baseline ${key}`)
  }
  const raw = parseResourceQueryPayload(output)
  const databaseGrowthBytes = raw.databaseBytes - baseline.databaseBytes
  const cronHistoryGrowthBytes = raw.cronHistoryBytes - baseline.cronHistoryBytes
  const deadlockDelta = raw.deadlocks - baseline.deadlocks
  if (raw.guardIdentityCount !== 1 || raw.guardJobId < 1 ||
    raw.currentMaxRunId < baseline.maxCronRunId ||
    raw.coveredAfterRunId > baseline.maxCronRunId || databaseGrowthBytes < 0 ||
    cronHistoryGrowthBytes < 0 || deadlockDelta < 0) {
    throw new Error("Resource query does not cover the accepted guarded baseline")
  }
  return validateResourceSample({
    observedAtUtcMs: raw.observedAtUtcMs,
    activeCronExecutions: raw.activeCronExecutions,
    targetRunCount: raw.maximumTargetRunId > baseline.maxCronRunId ? 1 : 0,
    targetRunFailures: raw.maximumTargetFailureRunId > baseline.maxCronRunId ? 1 : 0,
    guardRunCount: raw.guardRunCount,
    guardRunFailures: raw.guardFailureCount,
    guardCronHistoryEstimatedBytes:
      raw.guardRunCount * GUARD_CRON_HISTORY_ESTIMATED_BYTES_PER_ROW,
    totalTaskGrowthBytes: databaseGrowthBytes,
    databaseGrowthBytes,
    cronHistoryGrowthBytes,
    walDirectoryBytes: raw.walDirectoryBytes,
    waitingLocks: raw.waitingLocks,
    deadlockDelta,
    databaseBackends: raw.databaseBackends,
  })
}
