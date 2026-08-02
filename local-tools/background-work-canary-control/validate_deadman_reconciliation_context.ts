import type { DeadmanReconciliationContext } from "./deadman_reconciliation_types.ts"
import { validateNonnegativeInteger } from "./validate_nonnegative_integer.ts"
import { validateRunId } from "./validate_run_id.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"

export function validateDeadmanReconciliationContext(
  value: unknown,
): DeadmanReconciliationContext {
  const input = validateStrictRecord(value, [
    "mode", "runId", "generationSha256", "guardJobId",
    "startCronRunId", "workBaseline",
  ], "Dead-man reconciliation context")
  if (!['ambiguous', 'known'].includes(input.mode as string) ||
    typeof input.runId !== "string" || typeof input.generationSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(input.generationSha256)) {
    throw new Error("Dead-man reconciliation identity is invalid")
  }
  validateRunId(input.runId)
  validateNonnegativeInteger(input.startCronRunId, "Reconciliation starting run ID")
  if ((input.mode === "known" &&
      (!Number.isSafeInteger(input.guardJobId) || (input.guardJobId as number) < 1)) ||
    (input.mode === "ambiguous" && input.guardJobId !== null)) {
    throw new Error("Dead-man reconciliation guard ID is invalid")
  }
  const work = validateStrictRecord(input.workBaseline, [
    "toastReady", "routingReady", "deliveryReady", "queueReady",
  ], "Reconciliation work baseline")
  for (const key of ["toastReady", "routingReady", "deliveryReady", "queueReady"] as const) {
    validateNonnegativeInteger(work[key], `Reconciliation baseline ${key}`)
  }
  return { ...input, workBaseline: work } as unknown as DeadmanReconciliationContext
}
