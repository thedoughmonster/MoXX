import type { CombinedHeartbeatParseContext } from "./combined_heartbeat_types.ts"
import { validateNonnegativeInteger } from "./validate_nonnegative_integer.ts"
import { validateRunId } from "./validate_run_id.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"

export function validateCombinedHeartbeatContext(
  value: unknown,
): CombinedHeartbeatParseContext {
  const context = validateStrictRecord(value, [
    "runId", "guardJobId", "previousGenerationSha256", "nextGenerationSha256",
    "includeResource", "startCronRunId", "missedSamples", "overlappingSamples",
    "workBaseline", "resourceBaseline",
  ], "Combined heartbeat parse context")
  if (typeof context.runId !== "string") throw new Error("Combined run ID is invalid")
  validateRunId(context.runId)
  for (const key of [
    "guardJobId", "startCronRunId", "missedSamples", "overlappingSamples",
  ] as const) validateNonnegativeInteger(context[key], `Combined context ${key}`)
  if ((context.guardJobId as number) < 1 || typeof context.includeResource !== "boolean" ||
    typeof context.previousGenerationSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(context.previousGenerationSha256) ||
    typeof context.nextGenerationSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(context.nextGenerationSha256) ||
    context.previousGenerationSha256 === context.nextGenerationSha256) {
    throw new Error("Combined heartbeat identity context is invalid")
  }
  const work = validateStrictRecord(context.workBaseline, [
    "toastReady", "routingReady", "deliveryReady", "queueReady",
  ], "Combined heartbeat work baseline")
  for (const key of ["toastReady", "routingReady", "deliveryReady", "queueReady"] as const) {
    validateNonnegativeInteger(work[key], `Combined heartbeat work baseline ${key}`)
  }
  if ((context.includeResource && context.resourceBaseline === null) ||
    (!context.includeResource && context.resourceBaseline !== null)) {
    throw new Error("Combined heartbeat resource baseline presence is invalid")
  }
  return { ...context, workBaseline: work } as unknown as CombinedHeartbeatParseContext
}
