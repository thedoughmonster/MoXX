import type { DeadmanPhaseDependencies,
  DeadmanPhaseHandoff } from "./deadman_phase_types.ts"
import type { DeadmanReconciliationResult } from "./deadman_reconciliation_types.ts"

export async function appendReconciliationReceipt(
  handoff: DeadmanPhaseHandoff,
  result: DeadmanReconciliationResult,
  dependencies: Pick<DeadmanPhaseDependencies, "appendReceipt">,
): Promise<boolean> {
  if (handoff.receipt.poisoned) return false
  try {
    const terminal = result.terminalEvidence
    await dependencies.appendReceipt(handoff.receipt, {
      event_type: "deadman_reconciled",
      timestamp_utc: new Date(result.observedAtUtcMs).toISOString(),
      metrics: {
        status: "inactive",
        guard: result.guardJobId === null
          ? { active: false, count: 0 }
          : {
            active: false, count: 1, job_id: result.guardJobId,
            generation_sha256: terminal!.generationSha256,
            expiry_utc: terminal!.expiryUtc,
            terminal_guard_run_id: terminal!.guardRunId,
            terminal_guard_start_utc: terminal!.guardStartUtc,
            guard_run_status: terminal!.guardStatus,
            exact_identity_mask: terminal!.exactIdentityMask,
            active_before_mask: terminal!.activeBeforeMask,
            inactive_after_mask: terminal!.inactiveAfterMask,
            original_command_sha256: terminal!.originalCommandSha256,
            original_command_md5: terminal!.originalCommandMd5,
            terminal_command_sha256: terminal!.terminalCommandSha256,
            terminal_command_md5: terminal!.terminalCommandMd5,
            terminal_run_count: terminal!.successfulTerminalRunCount,
            terminal_failure_count: terminal!.terminalFailureCount,
          },
      },
    })
    return true
  } catch {
    return false
  }
}
