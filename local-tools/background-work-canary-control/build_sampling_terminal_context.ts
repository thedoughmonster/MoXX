import type { CanaryTerminalContext } from "./program_types.ts"
import type { ReleasedRuntime } from "./runtime_adapter_types.ts"
import type { SamplingPhaseResult } from "./sampling_phase_types.ts"

export function buildSamplingTerminalContext(
  runtime: ReleasedRuntime,
  result: Extract<SamplingPhaseResult,
    { status: "pre_guard_failure" | "sampling_failed_rollback_completed" }>,
  terminalAtUtc: string,
): CanaryTerminalContext | null {
  if (result.status === "pre_guard_failure") {
    if (!result.receipt || !result.runId || !result.receiptVerified ||
      result.receipt.poisoned) return null
    return {
      runtime, retainLock: false,
      artifactInput: {
        runtime, receipt: result.receipt, runId: result.runId,
        status: result.status, reason: result.reason,
        fastCount: null, resourceCount: null,
        guardResolution: "unknown", guardAbsent: null,
        targetJobs: null, finalFast: null, finalResource: null,
        deadmanEvidence: null,
        terminalAtUtc,
      },
    }
  }
  return {
    runtime, retainLock: false,
    artifactInput: {
      runtime, receipt: result.receipt, runId: result.runId,
      status: result.status, reason: result.reason,
      fastCount: result.samplesCompleted,
      resourceCount: result.resourceSamplesCompleted,
      guardResolution: result.rollback.guardPresent ? "inactive" : "proved_absent",
      guardAbsent: !result.rollback.guardPresent,
      targetJobs: result.rollback.targetJobs,
      finalFast: null, finalResource: null, deadmanEvidence: null, terminalAtUtc,
    },
  }
}
