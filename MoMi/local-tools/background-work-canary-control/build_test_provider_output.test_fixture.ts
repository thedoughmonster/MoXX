import { COMBINED_HEARTBEAT_MARKER } from "./combined_heartbeat_constants.ts"
import { DEADMAN_ADVISORY_LOCK_KEY, DEADMAN_EXPIRY_PLACEHOLDER,
} from "./deadman_command_constants.ts"
import { encodeQueryEnvelope } from "./encode_query_envelope.ts"
import { generateDeadmanCommand } from "./generate_deadman_command.ts"
import { GUARD_BOOTSTRAP_MARKER } from "./guard_bootstrap_constants.ts"
import { md5Text } from "./md5_text.ts"
import { VALID_ROLLBACK_INACTIVE_RESULT } from "./recovery_control.test_fixture.ts"
import { ROLLBACK_MARKER } from "./recovery_control_constants.ts"
import { EXPECTED_GUARD_NAME, EXPECTED_GUARD_SCHEDULE,
  EXPECTED_TARGET_JOBS } from "./sample_constants.ts"
import { VALID_FAST_SAMPLE } from "./sample_fixtures.test_fixture.ts"
import type { InternalProviderSqlKind } from "./runtime_adapter_types.ts"
import type { SamplingHarnessOptions,
  SamplingHarnessTelemetry } from "./sampling_test_types.test_fixture.ts"
import { FAST_SQL_MARKER, RESOURCE_SQL_MARKER } from "./sql_artifact_constants.ts"
import { sha256Text } from "./sha256_text.ts"

export function buildTestProviderOutput(
  kind: InternalProviderSqlKind,
  sql: string,
  telemetry: SamplingHarnessTelemetry,
  options: SamplingHarnessOptions,
): Uint8Array {
  const observedAtUtcMs = telemetry.nowUtcMs
  const inactiveFast = {
    ...VALID_FAST_SAMPLE, observedAtUtcMs, toastReady: 1,
    guard: { ...VALID_FAST_SAMPLE.guard, active: options.preexistingGuard === true },
    currentMaxRunId: 1_000, coveredAfterRunId: 0,
    maximumTargetRunId: 900, maximumTargetFailureRunId: 800,
    guardPresent: options.preexistingGuard === true,
    guardIdentityCount: options.preexistingGuard ? 1 : 0,
    guardJobId: options.preexistingGuard ? 12 : 0,
    guardRunCount: 0, guardFailureCount: 0,
  }
  for (const key of [
    "targetExecutions", "targetFailures", "guardFailures",
    "missedSamples", "overlappingSamples",
  ]) delete (inactiveFast as Record<string, unknown>)[key]
  const resource = {
    observedAtUtcMs, activeCronExecutions: 1, currentMaxRunId: 1_000,
    coveredAfterRunId: 0, maximumTargetRunId: 900,
    maximumTargetFailureRunId: 800,
    guardIdentityCount: options.preexistingGuard ? 1 : 0,
    guardJobId: options.preexistingGuard ? 12 : 0,
    guardRunCount: 0, guardFailureCount: 0, databaseBytes: 8_000_000,
    cronHistoryBytes: 6_000_000, walDirectoryBytes: 800_000_000,
    waitingLocks: 0, deadlocks: 4, databaseBackends: 13,
  }
  if (kind === "resource_sample") return encodeQueryEnvelope(RESOURCE_SQL_MARKER, resource)
  if (kind === "fast_sample") return encodeQueryEnvelope(FAST_SQL_MARKER, inactiveFast)
  if (kind === "rollback") {
    return encodeQueryEnvelope(ROLLBACK_MARKER, VALID_ROLLBACK_INACTIVE_RESULT)
  }
  const runId = sql.match(/'runId', '([a-z0-9-]+)'/)?.[1] ?? ""
  const next = sql.match(/'nextGenerationSha256', '([a-f0-9]{64})'/)?.[1]
    ?? sql.match(/'generationSha256', '([a-f0-9]{64})'/)?.[1] ?? ""
  const previous = sql.match(/'previousGenerationSha256', '([a-f0-9]{64})'/)?.[1]
  const expiryUtc = new Date(observedAtUtcMs + 30_000).toISOString().replace("Z", "000Z")
  const command = generateDeadmanCommand({
    runId, generationSha256: next, startCronRunId: 1_000,
    guardName: EXPECTED_GUARD_NAME,
    guardSchedule: EXPECTED_GUARD_SCHEDULE, targetJobs: EXPECTED_TARGET_JOBS,
    advisoryLockKey: DEADMAN_ADVISORY_LOCK_KEY,
    expiryPlaceholder: DEADMAN_EXPIRY_PLACEHOLDER,
  }).replace(DEADMAN_EXPIRY_PLACEHOLDER, expiryUtc)
  if (kind === "guard_bootstrap") return encodeQueryEnvelope(GUARD_BOOTSTRAP_MARKER, {
    guardJobId: options.bootstrapSchemaDrift ? 0 : 12,
    guardName: EXPECTED_GUARD_NAME,
    guardSchedule: EXPECTED_GUARD_SCHEDULE, guardActive: true,
    runId, generationSha256: next, expiryUtc,
    commandSha256: sha256Text(command), commandMd5: md5Text(command),
  })
  const index = telemetry.combinedCalls++
  const includeResource = kind === "guard_heartbeat_resource"
  const activeFast = {
    ...inactiveFast, guard: { ...VALID_FAST_SAMPLE.guard, active: true },
    guardPresent: true, guardIdentityCount: 1, guardJobId: 12,
    guardRunCount: index + 1, currentMaxRunId: 1_001 + index,
    toastReady: options.thresholdAt === index ? 0 : 1,
  }
  const activeResource = includeResource ? {
    ...resource, guardIdentityCount: 1, guardJobId: 12,
    guardRunCount: index + 1, currentMaxRunId: 1_001 + index,
    databaseBytes: resource.databaseBytes + index + 1,
    cronHistoryBytes: resource.cronHistoryBytes + (index + 1) * 4_096,
  } : null
  return encodeQueryEnvelope(COMBINED_HEARTBEAT_MARKER, {
    heartbeat: {
      guardJobId: 12, guardName: EXPECTED_GUARD_NAME,
      guardSchedule: EXPECTED_GUARD_SCHEDULE, guardActive: true, runId,
      previousGenerationSha256: previous, nextGenerationSha256: next,
      expiryUtc, commandSha256: sha256Text(command), commandMd5: md5Text(command),
      observedAtUtcMs,
    },
    fast: activeFast, resourceIncluded: includeResource, resource: activeResource,
  })
}
