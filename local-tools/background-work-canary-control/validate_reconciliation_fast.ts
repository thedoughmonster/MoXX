import type { DeadmanReconciliationContext } from "./deadman_reconciliation_types.ts"
import { encodeQueryEnvelope } from "./encode_query_envelope.ts"
import { evaluateDryRunThresholds } from "./evaluate_dry_run_thresholds.ts"
import { parseFastQueryOutput } from "./parse_fast_query_output.ts"
import { FAST_QUERY_SAMPLE_KEYS } from "./query_payload_constants.ts"
import type { FastSample } from "./sample_types.ts"
import { FAST_SQL_MARKER } from "./sql_artifact_constants.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"

export function validateReconciliationFast(
  value: unknown,
  context: DeadmanReconciliationContext,
  expectedGuardPresent: boolean,
  expectedGuardJobId: number,
): FastSample {
  const raw = validateStrictRecord(
    value, FAST_QUERY_SAMPLE_KEYS, "Reconciliation fast sample",
  )
  if (raw.guardPresent !== expectedGuardPresent ||
    raw.guardJobId !== expectedGuardJobId) {
    throw new Error("Reconciliation fast guard identity is invalid")
  }
  const fast = parseFastQueryOutput(
    encodeQueryEnvelope(FAST_SQL_MARKER, raw),
    {
      expectedGuardPresent, startCronRunId: context.startCronRunId,
      missedSamples: 0, overlappingSamples: 0,
    },
  )
  const reasons = evaluateDryRunThresholds(fast, context.workBaseline)
  if (fast.guard.active || !reasons.includes("guard_inactive") ||
    reasons.some((reason) => reason !== "guard_inactive")) {
    throw new Error("Reconciliation fast sample is unsafe")
  }
  return fast
}
