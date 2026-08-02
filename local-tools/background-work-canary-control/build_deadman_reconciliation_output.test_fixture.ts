import { DEADMAN_ADVISORY_LOCK_KEY, DEADMAN_EXPIRY_PLACEHOLDER,
  DEADMAN_TERMINAL_STATUS } from "./deadman_command_constants.ts"
import { DEADMAN_RECONCILIATION_MARKER } from "./deadman_reconciliation_constants.ts"
import type { DeadmanPhaseHandoff } from "./deadman_phase_types.ts"
import type { DeadmanReconciliationFault } from "./deadman_test_types.test_fixture.ts"
import { deriveDeadmanDeadline } from "./derive_deadman_deadline.ts"
import { encodeQueryEnvelope } from "./encode_query_envelope.ts"
import { generateDeadmanCommand } from "./generate_deadman_command.ts"
import { generateDeadmanTerminalCommand } from "./generate_deadman_terminal_command.ts"
import { md5Text } from "./md5_text.ts"
import { EXPECTED_GUARD_NAME, EXPECTED_GUARD_SCHEDULE,
  EXPECTED_TARGET_JOBS } from "./sample_constants.ts"
import { VALID_FAST_SAMPLE } from "./sample_fixtures.test_fixture.ts"
import { sha256Text } from "./sha256_text.ts"

export function buildDeadmanReconciliationOutput(
  handoff: DeadmanPhaseHandoff,
  observedAtUtcMs: number,
  guardPresent: boolean,
  fault?: DeadmanReconciliationFault,
): Uint8Array {
  const ambiguous = handoff.status === "bootstrap_ambiguous_deadman_fallback_pending"
  const generationSha256 = ambiguous
    ? handoff.attemptedGenerationSha256 : handoff.currentGenerationSha256
  const baseline = handoff.resourceBaseline.maxCronRunId
  const deadline = deriveDeadmanDeadline(handoff)
  const expiryUtc = new Date(deadline - 5_000).toISOString().replace("Z", "000Z")
  const original = generateDeadmanCommand({
    runId: handoff.runId, generationSha256, startCronRunId: baseline,
    guardName: EXPECTED_GUARD_NAME, guardSchedule: EXPECTED_GUARD_SCHEDULE,
    targetJobs: EXPECTED_TARGET_JOBS, advisoryLockKey: DEADMAN_ADVISORY_LOCK_KEY,
    expiryPlaceholder: DEADMAN_EXPIRY_PLACEHOLDER,
  }).replace(DEADMAN_EXPIRY_PLACEHOLDER, expiryUtc)
  const exactRunId = baseline + 5
  const normalStartMs = Date.parse(expiryUtc) + 1_000
  const historyStartUtc = new Date(fault === "late_history"
    ? Date.parse(expiryUtc) + 60_000 : normalStartMs).toISOString().replace("Z", "000Z")
  const runId = fault === "identity_drift"
    ? "run-ffffffffffffffffffffffff" : handoff.runId
  const exactIdentityMask = fault === "reassigned_id" ? 14 : 15
  const activeBeforeMask = fault === "active_before" ? 1 : 0
  const terminalInput = {
    runId, generationSha256, expiryUtc, guardRunId: exactRunId,
    guardStartUtc: historyStartUtc, exactIdentityMask, activeBeforeMask,
    inactiveAfterMask: 15, originalCommandSha256: sha256Text(original),
    originalCommandMd5: md5Text(original),
  }
  const terminal = generateDeadmanTerminalCommand(terminalInput)
  const targets = EXPECTED_TARGET_JOBS.map((job) => ({ ...job, active: false }))
  if (fault === "active_target") targets[0] = { ...targets[0], active: true }
  if (fault === "target_drift") targets[0] = {
    ...targets[0], commandMd5: "0".repeat(32),
  }
  const fast = {
    ...VALID_FAST_SAMPLE, observedAtUtcMs, targetJobs: targets,
    guard: { jobName: EXPECTED_GUARD_NAME, schedule: EXPECTED_GUARD_SCHEDULE,
      active: fault === "active_guard" },
    toastReady: handoff.workBaseline.toastReady,
    routingReady: handoff.workBaseline.routingReady,
    deliveryReady: handoff.workBaseline.deliveryReady,
    queueReady: handoff.workBaseline.queueReady,
    currentMaxRunId: baseline + 10, coveredAfterRunId: 0,
    maximumTargetRunId: baseline, maximumTargetFailureRunId: baseline,
    guardPresent, guardIdentityCount: guardPresent ? 1 : 0,
    guardJobId: guardPresent ? 12 : 0,
    guardRunCount: guardPresent ? 1 : 0, guardFailureCount: 0,
  }
  for (const key of ["targetExecutions", "targetFailures", "guardFailures",
    "missedSamples", "overlappingSamples"]) {
    delete (fast as Record<string, unknown>)[key]
  }
  const failed = fault === "failed_history"
  const late = fault === "late_history"
  const ambiguousHistory = fault === "ambiguous_history"
  return encodeQueryEnvelope(DEADMAN_RECONCILIATION_MARKER, {
    observedAtUtcMs, currentMaxRunId: baseline + 10, coveredAfterRunId: 0,
    guardIdentityCount: fault === "duplicate_guard" ? 2 : guardPresent ? 1 : 0,
    guardJobId: guardPresent ? 12 : 0,
    guardName: guardPresent ? EXPECTED_GUARD_NAME : null,
    guardSchedule: guardPresent ? EXPECTED_GUARD_SCHEDULE : null,
    guardActive: guardPresent ? fault === "active_guard" : null,
    runId: guardPresent ? runId : null,
    generationSha256: guardPresent ? generationSha256 : null,
    expiryUtc: guardPresent ? expiryUtc : null,
    terminalCommandSha256: guardPresent
      ? sha256Text(fault === "terminal_command_drift" ? `${terminal} ` : terminal) : null,
    terminalCommandMd5: guardPresent ? md5Text(terminal) : null,
    terminalGuardRunId: guardPresent ? exactRunId : 0,
    terminalGuardStartUtc: guardPresent ? historyStartUtc : null,
    terminalExpectedStatus: guardPresent ? DEADMAN_TERMINAL_STATUS : null,
    exactIdentityMask: guardPresent ? exactIdentityMask : 0,
    activeBeforeMask: guardPresent ? activeBeforeMask : 0,
    inactiveAfterMask: guardPresent ? 15 : 0,
    originalCommandSha256: guardPresent ? sha256Text(original) : null,
    originalCommandMd5: guardPresent ? md5Text(original) : null,
    maximumGuardRunId: guardPresent ? exactRunId : 0,
    maximumGuardSuccessRunId: guardPresent && !failed ? exactRunId : 0,
    maximumGuardFailureRunId: failed ? exactRunId : 0,
    successfulTerminalRunCount: guardPresent && !failed && !late ? 1 : 0,
    terminalFailureCount: failed ? 1 : 0,
    terminalHistoryStartUtc: guardPresent ? historyStartUtc : null,
    terminalHistoryStatus: guardPresent
      ? failed ? "failed" : DEADMAN_TERMINAL_STATUS : null,
    maximumAnyDeadmanRunId: ambiguousHistory ? baseline + 7
      : guardPresent ? exactRunId : 0,
    fast,
  })
}
