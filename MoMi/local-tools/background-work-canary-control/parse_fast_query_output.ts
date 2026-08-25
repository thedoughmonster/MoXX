import { FAST_QUERY_SAMPLE_KEYS } from "./query_payload_constants.ts"
import type { FastParseContext } from "./query_payload_types.ts"
import type { FastSample } from "./sample_types.ts"
import { FAST_SQL_MARKER } from "./sql_artifact_constants.ts"
import { parseCliQueryEnvelope } from "./parse_cli_query_envelope.ts"
import { validateFastSample } from "./validate_fast_sample.ts"
import { validateNonnegativeInteger } from "./validate_nonnegative_integer.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"

export function parseFastQueryOutput(
  output: Uint8Array,
  contextValue: unknown,
): FastSample {
  const context = validateStrictRecord(contextValue, [
    "expectedGuardPresent", "startCronRunId", "missedSamples", "overlappingSamples",
  ], "Fast query context") as FastParseContext
  if (typeof context.expectedGuardPresent !== "boolean") {
    throw new Error("Fast query guard expectation is invalid")
  }
  validateNonnegativeInteger(context.missedSamples, "Missed sample count")
  validateNonnegativeInteger(context.overlappingSamples, "Overlapping sample count")
  validateNonnegativeInteger(context.startCronRunId, "Starting Cron run ID")
  const raw = validateStrictRecord(
    parseCliQueryEnvelope(output, FAST_SQL_MARKER),
    FAST_QUERY_SAMPLE_KEYS,
    "Fast query sample",
  )
  if (typeof raw.guardPresent !== "boolean" ||
    raw.guardPresent !== context.expectedGuardPresent) {
    throw new Error("Fast query guard presence is invalid")
  }
  for (const key of [
    "currentMaxRunId", "coveredAfterRunId", "maximumTargetRunId",
    "maximumTargetFailureRunId", "guardIdentityCount", "guardJobId", "guardRunCount",
    "guardFailureCount",
  ] as const) validateNonnegativeInteger(raw[key], `Fast query sample ${key}`)
  const expectedGuardCount = context.expectedGuardPresent ? 1 : 0
  if (raw.guardIdentityCount !== expectedGuardCount ||
    (context.expectedGuardPresent ? (raw.guardJobId as number) < 1 : raw.guardJobId !== 0) ||
    (!context.expectedGuardPresent && (raw.guardRunCount !== 0 || raw.guardFailureCount !== 0)) ||
    (raw.currentMaxRunId as number) < context.startCronRunId ||
    (raw.coveredAfterRunId as number) > context.startCronRunId ||
    (raw.maximumTargetRunId as number) > (raw.currentMaxRunId as number) ||
    (raw.maximumTargetFailureRunId as number) > (raw.maximumTargetRunId as number) ||
    (raw.guardFailureCount as number) > (raw.guardRunCount as number)) {
    throw new Error("Fast query run-ID coverage is invalid")
  }
  const {
    guardPresent: _guardPresent, currentMaxRunId: _currentMaxRunId,
    coveredAfterRunId: _coveredAfterRunId, maximumTargetRunId,
    maximumTargetFailureRunId, guardIdentityCount: _guardIdentityCount,
    guardJobId: _guardJobId, guardFailureCount, ...sample
  } = raw
  return validateFastSample({
    ...sample,
    targetExecutions: (maximumTargetRunId as number) > context.startCronRunId ? 1 : 0,
    targetFailures: (maximumTargetFailureRunId as number) > context.startCronRunId ? 1 : 0,
    guardFailures: guardFailureCount,
    missedSamples: context.missedSamples,
    overlappingSamples: context.overlappingSamples,
  })
}
