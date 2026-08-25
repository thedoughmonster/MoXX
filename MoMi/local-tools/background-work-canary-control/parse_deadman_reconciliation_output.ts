import { DEADMAN_ADVISORY_LOCK_KEY, DEADMAN_EXPIRY_PLACEHOLDER,
  DEADMAN_TERMINAL_STATUS } from "./deadman_command_constants.ts"
import { DEADMAN_RECONCILIATION_MARKER,
  DEADMAN_RECONCILIATION_RESULT_KEYS } from "./deadman_reconciliation_constants.ts"
import type { DeadmanReconciliationResult } from "./deadman_reconciliation_types.ts"
import { generateDeadmanCommand } from "./generate_deadman_command.ts"
import { generateDeadmanTerminalCommand } from "./generate_deadman_terminal_command.ts"
import { md5Text } from "./md5_text.ts"
import { modelDeadmanReconciliation } from "./model_deadman_reconciliation.ts"
import { parseCliQueryEnvelope } from "./parse_cli_query_envelope.ts"
import { EXPECTED_GUARD_NAME, EXPECTED_GUARD_SCHEDULE,
  EXPECTED_TARGET_JOBS } from "./sample_constants.ts"
import { sha256Text } from "./sha256_text.ts"
import { validateDeadmanReconciliationContext } from "./validate_deadman_reconciliation_context.ts"
import { validateDeadmanActiveMasks } from "./validate_deadman_active_masks.ts"
import { validateNonnegativeInteger } from "./validate_nonnegative_integer.ts"
import { validateReconciliationFast } from "./validate_reconciliation_fast.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"
export function parseDeadmanReconciliationOutput(
  output: Uint8Array, contextValue: unknown, expectedActiveBeforeMask: number | readonly number[] = 0,
): DeadmanReconciliationResult {
  const expectedMasks = validateDeadmanActiveMasks(expectedActiveBeforeMask)
  const context = validateDeadmanReconciliationContext(contextValue)
  const row = validateStrictRecord(parseCliQueryEnvelope(
    output, DEADMAN_RECONCILIATION_MARKER), DEADMAN_RECONCILIATION_RESULT_KEYS,
  "Dead-man reconciliation result")
  for (const key of [
    "observedAtUtcMs", "currentMaxRunId", "coveredAfterRunId",
    "guardIdentityCount", "guardJobId", "terminalGuardRunId",
    "exactIdentityMask", "activeBeforeMask", "inactiveAfterMask",
    "maximumGuardRunId", "maximumGuardSuccessRunId", "maximumGuardFailureRunId",
    "successfulTerminalRunCount", "terminalFailureCount", "maximumAnyDeadmanRunId",
  ] as const) validateNonnegativeInteger(row[key], `Reconciliation ${key}`)
  if ((row.currentMaxRunId as number) < context.startCronRunId ||
    (row.coveredAfterRunId as number) > context.startCronRunId) {
    throw new Error("Reconciliation run history does not cover the baseline")
  }
  const count = row.guardIdentityCount as number
  if (count === 0) {
    const absentFields = [
      row.guardName, row.guardSchedule, row.guardActive, row.runId,
      row.generationSha256, row.expiryUtc, row.terminalCommandSha256,
      row.terminalCommandMd5, row.terminalGuardStartUtc,
      row.terminalExpectedStatus, row.originalCommandSha256,
      row.originalCommandMd5, row.terminalHistoryStartUtc,
      row.terminalHistoryStatus,
    ]
    const fast = validateReconciliationFast(row.fast, context, false, 0)
    const outcome = modelDeadmanReconciliation({
      mode: context.mode, guardIdentityCount: count,
      guardIdentityMatches: false, targetStateSafe: true,
      commandBindingValid: false, successfulPostExpiryRun: false,
      failureAfterBaseline: (row.maximumGuardFailureRunId as number) >
        context.startCronRunId,
      ambiguousHistoryAfterBaseline: (row.maximumAnyDeadmanRunId as number) >
        context.startCronRunId,
    })
    if (row.guardJobId !== 0 || row.terminalGuardRunId !== 0 ||
      row.exactIdentityMask !== 0 || row.activeBeforeMask !== 0 ||
      row.inactiveAfterMask !== 0 || absentFields.some((field) => field !== null) ||
      row.maximumGuardRunId !== 0 || row.maximumGuardSuccessRunId !== 0 ||
      row.maximumGuardFailureRunId !== 0 || row.successfulTerminalRunCount !== 0 ||
      row.terminalFailureCount !== 0 ||
      outcome !== "bootstrap_not_committed_or_rolled_back") {
      throw new Error("Absent bootstrap reconciliation is ambiguous")
    }
    return { status: outcome, observedAtUtcMs: row.observedAtUtcMs as number,
      guardJobId: null, expiryUtc: null, terminalEvidence: null, fast }
  }
  if (count !== 1 || !Number.isSafeInteger(row.guardJobId) ||
    (row.guardJobId as number) < 1 || row.guardName !== EXPECTED_GUARD_NAME ||
    row.guardSchedule !== EXPECTED_GUARD_SCHEDULE || row.guardActive !== false ||
    row.runId !== context.runId || row.generationSha256 !== context.generationSha256 ||
    (context.mode === "known" && row.guardJobId !== context.guardJobId)) {
    throw new Error("Dead-man guard identity is not exact and inactive")
  }
  const expiryUtc = typeof row.expiryUtc === "string" ? row.expiryUtc : ""
  const startUtc = typeof row.terminalGuardStartUtc === "string" ? row.terminalGuardStartUtc : ""
  const historyStartUtc = typeof row.terminalHistoryStartUtc === "string"
    ? row.terminalHistoryStartUtc : ""
  for (const timestamp of [expiryUtc, startUtc, historyStartUtc]) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(timestamp) ||
      Number.isNaN(Date.parse(timestamp))) throw new Error("Dead-man timestamp is invalid")
  }
  const original = generateDeadmanCommand({
    runId: context.runId, generationSha256: context.generationSha256,
    startCronRunId: context.startCronRunId,
    guardName: EXPECTED_GUARD_NAME, guardSchedule: EXPECTED_GUARD_SCHEDULE,
    targetJobs: EXPECTED_TARGET_JOBS, advisoryLockKey: DEADMAN_ADVISORY_LOCK_KEY,
    expiryPlaceholder: DEADMAN_EXPIRY_PLACEHOLDER,
  }).replace(DEADMAN_EXPIRY_PLACEHOLDER, expiryUtc)
  if (row.originalCommandSha256 !== sha256Text(original) ||
    row.originalCommandMd5 !== md5Text(original)) {
    throw new Error("Original dead-man command binding is invalid")
  }
  const terminalInput = {
    runId: context.runId, generationSha256: context.generationSha256,
    expiryUtc, guardRunId: row.terminalGuardRunId as number,
    guardStartUtc: startUtc, exactIdentityMask: row.exactIdentityMask as number,
    activeBeforeMask: row.activeBeforeMask as number,
    inactiveAfterMask: row.inactiveAfterMask as number,
    originalCommandSha256: row.originalCommandSha256 as string,
    originalCommandMd5: row.originalCommandMd5 as string,
  }
  const terminal = generateDeadmanTerminalCommand(terminalInput)
  const terminalBound = row.terminalCommandSha256 === sha256Text(terminal) &&
    row.terminalCommandMd5 === md5Text(terminal)
  const exactRun = row.terminalGuardRunId as number
  const startMs = Date.parse(startUtc)
  const expiryMs = Date.parse(expiryUtc)
  const success = exactRun > context.startCronRunId &&
    row.maximumGuardRunId === exactRun && row.maximumGuardSuccessRunId === exactRun &&
    row.maximumGuardFailureRunId === 0 && row.successfulTerminalRunCount === 1 &&
    row.terminalFailureCount === 0 && row.terminalExpectedStatus === DEADMAN_TERMINAL_STATUS &&
    row.terminalHistoryStatus === DEADMAN_TERMINAL_STATUS &&
    historyStartUtc === startUtc && startMs >= expiryMs && startMs <= expiryMs + 5_000
  const masksSafe = row.exactIdentityMask === 15 &&
    expectedMasks.includes(row.activeBeforeMask as number) &&
    row.inactiveAfterMask === 15
  const fast = validateReconciliationFast(row.fast, context, true, row.guardJobId as number)
  const outcome = modelDeadmanReconciliation({
    mode: context.mode, guardIdentityCount: count, guardIdentityMatches: true,
    targetStateSafe: masksSafe, commandBindingValid: terminalBound,
    successfulPostExpiryRun: success,
    failureAfterBaseline: (row.maximumGuardFailureRunId as number) >
      context.startCronRunId,
    ambiguousHistoryAfterBaseline: row.maximumAnyDeadmanRunId !== exactRun,
  })
  if (outcome !== "deadman_reconciled") throw new Error("Dead-man execution evidence is unsafe")
  return {
    status: outcome, observedAtUtcMs: row.observedAtUtcMs as number,
    guardJobId: row.guardJobId as number, expiryUtc,
    terminalEvidence: {
      ...terminalInput, guardStatus: DEADMAN_TERMINAL_STATUS,
      terminalCommandSha256: row.terminalCommandSha256 as string,
      terminalCommandMd5: row.terminalCommandMd5 as string,
      successfulTerminalRunCount: 1, terminalFailureCount: 0,
    }, fast,
  }
}
