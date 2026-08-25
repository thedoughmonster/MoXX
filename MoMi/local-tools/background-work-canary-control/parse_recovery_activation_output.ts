import type { GuardBootstrapResult } from "./guard_bootstrap_types.ts"
import { parseCliQueryEnvelope } from "./parse_cli_query_envelope.ts"
import { RECOVERY_ACTIVATION_MARKER,
  RECOVERY_SNAPSHOT_OUTPUT_LIMIT_BYTES } from "./recovery_constants.ts"
import { parseRecoverySnapshot } from "./parse_recovery_snapshot.ts"
import type { RecoveryActivation } from "./recovery_types.ts"
import { validateNonnegativeInteger } from "./validate_nonnegative_integer.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"
import { validateTargetJobs } from "./validate_target_jobs.ts"
import { validateRecoveryPreflight } from "./validate_recovery_preflight.ts"

export function parseRecoveryActivationOutput(
  output: Uint8Array, guard: GuardBootstrapResult,
): RecoveryActivation {
  const row = validateStrictRecord(parseCliQueryEnvelope(output,
    RECOVERY_ACTIVATION_MARKER, RECOVERY_SNAPSHOT_OUTPUT_LIMIT_BYTES),
    ["startedAtUtcMs", "frozen", "targetJobs",
    "guardJobId", "generationSha256", "guardCommandSha256"], "Recovery activation")
  const startedAtUtcMs = validateNonnegativeInteger(row.startedAtUtcMs,
    "Recovery activation timestamp")
  const frozen = validateRecoveryPreflight(parseRecoverySnapshot(row.frozen), 1)
  const targetJobs = validateTargetJobs(row.targetJobs)
  if (startedAtUtcMs !== frozen.observedAtUtcMs || row.guardJobId !== guard.guardJobId ||
    row.generationSha256 !== guard.generationSha256 ||
    row.guardCommandSha256 !== guard.commandSha256 ||
    targetJobs.find((job) => job.jobId === 4)?.active !== false ||
    targetJobs.filter((job) => job.jobId !== 4).some((job) => !job.active)) {
    throw new Error("Recovery activation readback is invalid")
  }
  return { startedAtUtcMs, frozen, targetJobs, guardJobId: guard.guardJobId,
    generationSha256: guard.generationSha256,
    guardCommandSha256: guard.commandSha256 }
}
