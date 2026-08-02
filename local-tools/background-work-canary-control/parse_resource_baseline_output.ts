import type { ResourceBaseline } from "./query_payload_types.ts"
import { parseResourceQueryPayload } from "./parse_resource_query_payload.ts"

export function parseResourceBaselineOutput(output: Uint8Array): ResourceBaseline {
  const raw = parseResourceQueryPayload(output)
  if (raw.guardIdentityCount !== 0 || raw.guardJobId !== 0 ||
    raw.guardRunCount !== 0 || raw.guardFailureCount !== 0) {
    throw new Error("Pre-guard resource baseline found a named guard")
  }
  return {
    maxCronRunId: raw.currentMaxRunId,
    databaseBytes: raw.databaseBytes,
    cronHistoryBytes: raw.cronHistoryBytes,
    deadlocks: raw.deadlocks,
  }
}
