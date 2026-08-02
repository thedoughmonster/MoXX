import { COMBINED_HEARTBEAT_MARKER } from "./combined_heartbeat_constants.ts"
import {
  VALID_GUARD_HEARTBEAT_INPUT,
  VALID_GUARD_HEARTBEAT_RESULT,
} from "./guard_heartbeat.test_fixture.ts"
import {
  VALID_FAST_QUERY_SAMPLE,
  VALID_RESOURCE_BASELINE,
  VALID_RESOURCE_QUERY_SAMPLE,
  VALID_START_CRON_RUN_ID,
} from "./query_sample_fixtures.test_fixture.ts"

export const COMBINED_OBSERVED_AT_UTC_MS =
  Date.parse(VALID_GUARD_HEARTBEAT_RESULT.expiryUtc) - 30_000

export const VALID_COMBINED_FAST_RAW = {
  ...VALID_FAST_QUERY_SAMPLE,
  observedAtUtcMs: COMBINED_OBSERVED_AT_UTC_MS,
  guardJobId: VALID_GUARD_HEARTBEAT_INPUT.guardJobId,
  toastReady: 44,
}

export const VALID_COMBINED_RESOURCE_RAW = {
  ...VALID_RESOURCE_QUERY_SAMPLE,
  observedAtUtcMs: COMBINED_OBSERVED_AT_UTC_MS,
  guardJobId: VALID_GUARD_HEARTBEAT_INPUT.guardJobId,
}

export const VALID_COMBINED_CONTEXT = {
  runId: VALID_GUARD_HEARTBEAT_INPUT.runId,
  guardJobId: VALID_GUARD_HEARTBEAT_INPUT.guardJobId,
  previousGenerationSha256: VALID_GUARD_HEARTBEAT_INPUT.currentGenerationSha256,
  nextGenerationSha256: VALID_GUARD_HEARTBEAT_INPUT.nextGenerationSha256,
  includeResource: false,
  startCronRunId: VALID_START_CRON_RUN_ID,
  missedSamples: 0,
  overlappingSamples: 0,
  workBaseline: { toastReady: 44, routingReady: 0, deliveryReady: 0, queueReady: 0 },
  resourceBaseline: null,
}

export const VALID_COMBINED_RESULT = {
  heartbeat: {
    ...VALID_GUARD_HEARTBEAT_RESULT,
    observedAtUtcMs: COMBINED_OBSERVED_AT_UTC_MS,
  },
  fast: VALID_COMBINED_FAST_RAW,
  resourceIncluded: false,
  resource: null,
}

export function encodeCombinedResult(sample: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify([{
    marker: COMBINED_HEARTBEAT_MARKER,
    schema_version: 1,
    sample,
  }])}\n`)
}

export { VALID_GUARD_HEARTBEAT_INPUT, VALID_RESOURCE_BASELINE }
