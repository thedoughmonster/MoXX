import { appendReceipt } from "./append_receipt.ts"
import type { RecoveryPreflightFailure } from "./recovery_preflight_failure_types.ts"
import type { RecoveryState } from "./recovery_types.ts"
import { verifyReceiptFile } from "./verify_receipt_file.ts"
import { writeRecoveryPreflightFailure } from "./write_recovery_preflight_failure.ts"

export async function recordRecoveryPreflightFailure(
  state: RecoveryState, failure: RecoveryPreflightFailure,
): Promise<{ path: string; sha256: string }> {
  const groups = failure.invariantGroups
  await appendReceipt(state.receipt, { event_type: "failure",
    timestamp_utc: new Date().toISOString(), metrics: {
      status: "failed", error_class: "pre_guard_failure",
      failure_stage: failure.stage, failure_reason: failure.reasonCategory,
      failure_fingerprint: failure.failureFingerprint, duration_ms: failure.durationMs,
      ...(failure.childExitCode === undefined ? {} : {
        child_exit_code: failure.childExitCode }),
      ...(failure.providerCategory === undefined ? {} : {
        provider_code: failure.providerCategory }),
      ...(failure.parseEvidence === undefined ? {} : {
        parse_subreason: failure.parseEvidence.subreason,
        observed_top_level_type: failure.parseEvidence.topLevelType,
        observed_row_count: failure.parseEvidence.rowCount,
        observed_outer_unexpected_keys: failure.parseEvidence.outerUnexpectedKeyCount,
        observed_sample_unexpected_keys: failure.parseEvidence.sampleUnexpectedKeyCount }),
      ...(groups === undefined ? {} : {
        invariant_work_rejected: groups.work, invariant_control_rejected: groups.control,
        invariant_cohort_rejected: groups.cohort, invariant_routes_rejected: groups.routes,
        invariant_safety_rejected: groups.safety }),
    } })
  return await writeRecoveryPreflightFailure(state, failure,
    await verifyReceiptFile(state.receipt.path))
}
