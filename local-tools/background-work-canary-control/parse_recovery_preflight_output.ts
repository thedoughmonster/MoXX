import { parseCliQueryEnvelope } from "./parse_cli_query_envelope.ts"
import { RECOVERY_PREFLIGHT_MARKER,
  RECOVERY_SNAPSHOT_OUTPUT_LIMIT_BYTES } from "./recovery_constants.ts"
import type { RecoverySnapshot } from "./recovery_types.ts"
import { parseRecoverySnapshot } from "./parse_recovery_snapshot.ts"

export function parseRecoveryPreflightOutput(output: Uint8Array): RecoverySnapshot {
  return parseRecoverySnapshot(
    parseCliQueryEnvelope(output, RECOVERY_PREFLIGHT_MARKER,
      RECOVERY_SNAPSHOT_OUTPUT_LIMIT_BYTES),
  )
}
