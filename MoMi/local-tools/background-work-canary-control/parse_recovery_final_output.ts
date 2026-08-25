import { parseCliQueryEnvelope } from "./parse_cli_query_envelope.ts"
import { RECOVERY_FINAL_MARKER,
  RECOVERY_SNAPSHOT_OUTPUT_LIMIT_BYTES } from "./recovery_constants.ts"
import { parseRecoverySnapshot } from "./parse_recovery_snapshot.ts"
import type { RecoverySnapshot } from "./recovery_types.ts"

export function parseRecoveryFinalOutput(output: Uint8Array): RecoverySnapshot {
  const sample = parseRecoverySnapshot(parseCliQueryEnvelope(output,
    RECOVERY_FINAL_MARKER, RECOVERY_SNAPSHOT_OUTPUT_LIMIT_BYTES))
  if (sample.targetJobs.some((job) => job.active) || sample.guardIdentityCount !== 0 ||
    sample.waitingLocks !== 0) throw new Error("Recovery final control state is not clean")
  return sample
}
