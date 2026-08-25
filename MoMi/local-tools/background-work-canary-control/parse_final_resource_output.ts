import type { ResourceBaseline } from "./query_payload_types.ts"
import { parseResourceQueryPayload } from "./parse_resource_query_payload.ts"
import type { ResourceSample } from "./sample_types.ts"
import { validateNonnegativeInteger } from "./validate_nonnegative_integer.ts"
import { validateResourceSample } from "./validate_resource_sample.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"

export function parseFinalResourceOutput(
  output: Uint8Array,
  baselineValue: unknown,
): ResourceSample {
  const baseline = validateStrictRecord(
    baselineValue, ["maxCronRunId", "databaseBytes", "cronHistoryBytes", "deadlocks"],
    "Final resource baseline",
  ) as ResourceBaseline
  for (const key of [
    "maxCronRunId", "databaseBytes", "cronHistoryBytes", "deadlocks",
  ] as const) validateNonnegativeInteger(baseline[key], `Final baseline ${key}`)
  const raw = parseResourceQueryPayload(output)
  const databaseGrowthBytes = raw.databaseBytes - baseline.databaseBytes
  const cronHistoryGrowthBytes = raw.cronHistoryBytes - baseline.cronHistoryBytes
  const deadlockDelta = raw.deadlocks - baseline.deadlocks
  if (raw.guardIdentityCount !== 0 || raw.guardJobId !== 0 ||
    raw.guardRunCount !== 0 || raw.guardFailureCount !== 0 ||
    raw.currentMaxRunId < baseline.maxCronRunId ||
    raw.coveredAfterRunId > baseline.maxCronRunId ||
    raw.maximumTargetRunId > baseline.maxCronRunId ||
    raw.maximumTargetFailureRunId > baseline.maxCronRunId ||
    databaseGrowthBytes < 0 || cronHistoryGrowthBytes < 0 || deadlockDelta < 0) {
    throw new Error("Final resource readback is not an inactive whole-run sample")
  }
  return validateResourceSample({
    observedAtUtcMs: raw.observedAtUtcMs,
    activeCronExecutions: raw.activeCronExecutions,
    targetRunCount: 0, targetRunFailures: 0,
    guardRunCount: 0, guardRunFailures: 0,
    guardCronHistoryEstimatedBytes: 0,
    totalTaskGrowthBytes: databaseGrowthBytes,
    databaseGrowthBytes, cronHistoryGrowthBytes,
    walDirectoryBytes: raw.walDirectoryBytes,
    waitingLocks: raw.waitingLocks, deadlockDelta,
    databaseBackends: raw.databaseBackends,
  })
}
