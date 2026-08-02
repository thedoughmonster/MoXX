import type { DeadmanPhaseHandoff,
  DeadmanPhaseResult } from "./deadman_phase_types.ts"
import type { CanaryTerminalContext } from "./program_types.ts"
import type { ReleasedRuntime } from "./runtime_adapter_types.ts"

export function buildDeadmanTerminalContext(
  runtime: ReleasedRuntime,
  handoff: DeadmanPhaseHandoff,
  result: DeadmanPhaseResult,
  terminalAtUtc: string,
): CanaryTerminalContext {
  const counts = "samplesCompleted" in handoff ? {
    fastCount: handoff.samplesCompleted,
    resourceCount: handoff.resourceSamplesCompleted,
  } : { fastCount: null, resourceCount: null }
  if (result.status === "manual_reconciliation_required") {
    return {
      runtime, retainLock: true,
      artifactInput: {
        runtime, receipt: result.receipt, runId: result.runId,
        status: result.status, reason: result.reason, ...counts,
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
      status: result.status, reason: null, ...counts,
      guardResolution: result.guardResolution, guardAbsent: true,
      targetJobs: result.finalFast.targetJobs,
      finalFast: result.finalFast, finalResource: result.finalResource,
      deadmanEvidence: result.terminalEvidence,
      terminalAtUtc,
    },
  }
}
