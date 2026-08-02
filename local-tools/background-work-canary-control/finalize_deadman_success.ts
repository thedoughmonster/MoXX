import type { DeadmanPhaseDependencies, DeadmanPhaseHandoff,
  DeadmanPhaseResult, DeadmanVerifiedStatus } from "./deadman_phase_types.ts"
import { finalizeDeadmanManual } from "./finalize_deadman_manual.ts"
import type { FinalReadbackResult } from "./final_readback_types.ts"
import type { CleanupResult } from "./recovery_control_types.ts"
import type { DeadmanTerminalEvidence } from "./deadman_terminal_types.ts"

export async function finalizeDeadmanSuccess(
  handoff: DeadmanPhaseHandoff,
  status: DeadmanVerifiedStatus,
  guardResolution: "cleaned" | "proved_absent",
  cleanup: CleanupResult | null,
  final: Extract<FinalReadbackResult, { status: "passed" }>,
  terminalEvidence: DeadmanTerminalEvidence | null,
  dependencies: DeadmanPhaseDependencies,
  deferLockRelease = false,
): Promise<DeadmanPhaseResult> {
  try {
    const holderLost = handoff.runtime.lock.status() === "lost" ||
      handoff.runtime.lock.lossSignal.aborted
    const effectiveStatus = holderLost
      ? "failure_recovered_by_deadman" : status
    await dependencies.appendReceipt(handoff.receipt, {
      event_type: "run_completed",
      timestamp_utc: new Date(dependencies.clock.nowUtcMs()).toISOString(),
      metrics: { status: effectiveStatus },
    })
    const receiptVerification = await dependencies.verifyReceipt(handoff.receipt.path)
    let lockReleased = false
    if (!deferLockRelease && !holderLost) {
      try {
        await handoff.runtime.lock.release()
        lockReleased = true
      } catch {
        return await finalizeDeadmanManual(handoff, "lock_release_failed", {
          cleanupAttempted: guardResolution === "cleaned",
          guardIdentityCount: 0, guardJobId: null,
        }, dependencies)
      }
    }
    return {
      status: effectiveStatus, runId: handoff.runId, guardResolution,
      receipt: handoff.receipt, receiptVerification, cleanup,
      finalFast: final.fast, finalResource: final.resource,
      terminalEvidence,
      lockReleased,
    }
  } catch {
    return await finalizeDeadmanManual(handoff,
      handoff.receipt.poisoned ? "receipt_failure" : "receipt_verification_failed", {
        cleanupAttempted: guardResolution === "cleaned",
        guardIdentityCount: 0, guardJobId: null,
      }, dependencies)
  }
}
