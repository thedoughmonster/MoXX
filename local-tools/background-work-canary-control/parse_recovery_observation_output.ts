import { parseCliQueryEnvelope } from "./parse_cli_query_envelope.ts"
import { RECOVERY_OBSERVATION_MARKER,
  RECOVERY_SNAPSHOT_OUTPUT_LIMIT_BYTES } from "./recovery_constants.ts"
import { RECOVERY_OBSERVATION_EXTRA_KEYS,
  RECOVERY_SNAPSHOT_KEYS } from "./recovery_snapshot_keys.ts"
import { parseRecoverySnapshot } from "./parse_recovery_snapshot.ts"
import type { RecoveryObservation } from "./recovery_types.ts"
import { validateNonnegativeInteger } from "./validate_nonnegative_integer.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"

export function parseRecoveryObservationOutput(
  output: Uint8Array, previousGenerationSha256: string,
  nextGenerationSha256: string, guardJobId: number,
): RecoveryObservation {
  const top = validateStrictRecord(parseCliQueryEnvelope(output,
    RECOVERY_OBSERVATION_MARKER, RECOVERY_SNAPSHOT_OUTPUT_LIMIT_BYTES),
    ["previousGenerationSha256",
    "nextGenerationSha256", "guardJobId", "observation"], "Recovery observation")
  if (top.previousGenerationSha256 !== previousGenerationSha256 ||
    top.nextGenerationSha256 !== nextGenerationSha256 || top.guardJobId !== guardJobId) {
    throw new Error("Recovery observation guard generation drifted")
  }
  const raw = validateStrictRecord(top.observation,
    [...RECOVERY_SNAPSHOT_KEYS, ...RECOVERY_OBSERVATION_EXTRA_KEYS],
    "Recovery observation body")
  const snapshot = parseRecoverySnapshot(Object.fromEntries(
    RECOVERY_SNAPSHOT_KEYS.map((key) => [key, raw[key]]),
  ))
  for (const key of RECOVERY_OBSERVATION_EXTRA_KEYS) {
    validateNonnegativeInteger(raw[key], `Recovery observation ${key}`)
  }
  return { ...snapshot, ...Object.fromEntries(RECOVERY_OBSERVATION_EXTRA_KEYS.map(
    (key) => [key, raw[key]],
  )) } as RecoveryObservation
}
