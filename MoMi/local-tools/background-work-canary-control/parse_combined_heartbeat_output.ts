import {
  COMBINED_HEARTBEAT_EVIDENCE_KEYS,
  COMBINED_HEARTBEAT_MARKER,
  COMBINED_HEARTBEAT_RESULT_KEYS,
} from "./combined_heartbeat_constants.ts"
import type { CombinedHeartbeatParseResult } from "./combined_heartbeat_types.ts"
import { encodeQueryEnvelope } from "./encode_query_envelope.ts"
import { evaluateDryRunThresholds } from "./evaluate_dry_run_thresholds.ts"
import { GUARD_HEARTBEAT_MARKER } from "./guard_heartbeat_constants.ts"
import { parseCliQueryEnvelope } from "./parse_cli_query_envelope.ts"
import { parseFastQueryOutput } from "./parse_fast_query_output.ts"
import { parseGuardHeartbeatOutput } from "./parse_guard_heartbeat_output.ts"
import { parseResourceQueryOutput } from "./parse_resource_query_output.ts"
import {
  FAST_QUERY_SAMPLE_KEYS,
  RESOURCE_QUERY_SAMPLE_KEYS,
} from "./query_payload_constants.ts"
import {
  FAST_SQL_MARKER,
  RESOURCE_SQL_MARKER,
} from "./sql_artifact_constants.ts"
import type { ResourceSample } from "./sample_types.ts"
import { validateCombinedHeartbeatContext } from "./validate_combined_heartbeat_context.ts"
import { validateNonnegativeInteger } from "./validate_nonnegative_integer.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"

export function parseCombinedHeartbeatOutput(
  output: Uint8Array,
  contextValue: unknown,
): CombinedHeartbeatParseResult {
  const context = validateCombinedHeartbeatContext(contextValue)
  const top = validateStrictRecord(
    parseCliQueryEnvelope(output, COMBINED_HEARTBEAT_MARKER),
    COMBINED_HEARTBEAT_RESULT_KEYS,
    "Combined heartbeat result",
  )
  if (top.resourceIncluded !== context.includeResource ||
    (context.includeResource ? top.resource === null : top.resource !== null)) {
    throw new Error("Combined heartbeat resource presence mismatch")
  }
  const rawHeartbeat = validateStrictRecord(
    top.heartbeat, COMBINED_HEARTBEAT_EVIDENCE_KEYS, "Combined heartbeat evidence",
  )
  validateNonnegativeInteger(rawHeartbeat.observedAtUtcMs, "Heartbeat observation clock")
  const { observedAtUtcMs, ...heartbeatEvidence } = rawHeartbeat
  const heartbeat = parseGuardHeartbeatOutput(
    encodeQueryEnvelope(GUARD_HEARTBEAT_MARKER, heartbeatEvidence),
    {
      runId: context.runId,
      guardJobId: context.guardJobId,
      previousGenerationSha256: context.previousGenerationSha256,
      nextGenerationSha256: context.nextGenerationSha256,
      startCronRunId: context.startCronRunId,
    },
  )
  if (observedAtUtcMs !== Date.parse(heartbeat.expiryUtc) - 30_000) {
    throw new Error("Combined heartbeat observation clock mismatch")
  }
  const rawFast = validateStrictRecord(
    top.fast, FAST_QUERY_SAMPLE_KEYS, "Combined fast sample",
  )
  if (rawFast.guardPresent !== true || rawFast.guardIdentityCount !== 1 ||
    rawFast.guardJobId !== context.guardJobId || rawFast.observedAtUtcMs !== observedAtUtcMs) {
    throw new Error("Combined fast guard or clock mismatch")
  }
  const fast = parseFastQueryOutput(
    encodeQueryEnvelope(FAST_SQL_MARKER, rawFast),
    {
      expectedGuardPresent: true,
      startCronRunId: context.startCronRunId,
      missedSamples: context.missedSamples,
      overlappingSamples: context.overlappingSamples,
    },
  )
  let resource: ResourceSample | null = null
  if (context.includeResource) {
    const rawResource = validateStrictRecord(
      top.resource, RESOURCE_QUERY_SAMPLE_KEYS, "Combined resource sample",
    )
    if (rawResource.guardIdentityCount !== 1 ||
      rawResource.guardJobId !== context.guardJobId ||
      rawResource.observedAtUtcMs !== observedAtUtcMs) {
      throw new Error("Combined resource guard or clock mismatch")
    }
    resource = parseResourceQueryOutput(
      encodeQueryEnvelope(RESOURCE_SQL_MARKER, rawResource),
      context.resourceBaseline!,
    )
  }
  const stopReasons = evaluateDryRunThresholds(fast, context.workBaseline, resource ?? undefined)
  return {
    status: stopReasons.length === 0
      ? "heartbeat_committed_passed"
      : "heartbeat_committed_stop_required",
    heartbeat: { ...heartbeat, observedAtUtcMs: observedAtUtcMs as number },
    fast,
    resourceIncluded: context.includeResource,
    resource,
    stopReasons,
  }
}
