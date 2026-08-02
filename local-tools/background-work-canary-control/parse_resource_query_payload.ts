import { RESOURCE_QUERY_SAMPLE_KEYS } from "./query_payload_constants.ts"
import type { ResourceQuerySample } from "./query_payload_types.ts"
import { RESOURCE_SQL_MARKER } from "./sql_artifact_constants.ts"
import { parseCliQueryEnvelope } from "./parse_cli_query_envelope.ts"
import { validateNonnegativeInteger } from "./validate_nonnegative_integer.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"

export function parseResourceQueryPayload(output: Uint8Array): ResourceQuerySample {
  const raw = validateStrictRecord(
    parseCliQueryEnvelope(output, RESOURCE_SQL_MARKER),
    RESOURCE_QUERY_SAMPLE_KEYS,
    "Resource query sample",
  ) as unknown as ResourceQuerySample
  for (const key of RESOURCE_QUERY_SAMPLE_KEYS) {
    validateNonnegativeInteger(raw[key], `Resource query sample ${key}`)
  }
  if (raw.coveredAfterRunId > raw.currentMaxRunId ||
    raw.maximumTargetRunId > raw.currentMaxRunId ||
    raw.maximumTargetFailureRunId > raw.currentMaxRunId ||
    raw.maximumTargetFailureRunId > raw.maximumTargetRunId ||
    raw.guardFailureCount > raw.guardRunCount) {
    throw new Error("Resource query cumulative evidence is invalid")
  }
  return raw
}
