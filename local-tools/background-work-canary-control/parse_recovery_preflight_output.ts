import { parseCliQueryEnvelope } from "./parse_cli_query_envelope.ts"
import { RECOVERY_PREFLIGHT_MARKER } from "./recovery_constants.ts"
import type { RecoverySnapshot } from "./recovery_types.ts"
import { parseRecoverySnapshot } from "./parse_recovery_snapshot.ts"
import { validateRecoveryPreflight } from "./validate_recovery_preflight.ts"

export function parseRecoveryPreflightOutput(output: Uint8Array): RecoverySnapshot {
  return validateRecoveryPreflight(parseRecoverySnapshot(
    parseCliQueryEnvelope(output, RECOVERY_PREFLIGHT_MARKER),
  ))
}
