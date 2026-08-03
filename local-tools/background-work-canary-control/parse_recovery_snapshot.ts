import { RECOVERY_SNAPSHOT_KEYS } from "./recovery_snapshot_keys.ts"
import { parseRecoveryDueOccurrences } from "./parse_recovery_due_occurrences.ts"
import type { RecoverySnapshot } from "./recovery_types.ts"
import { validateNonnegativeInteger } from "./validate_nonnegative_integer.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"
import { validateTargetJobs } from "./validate_target_jobs.ts"

export function parseRecoverySnapshot(value: unknown): RecoverySnapshot {
  const row = validateStrictRecord(value, RECOVERY_SNAPSHOT_KEYS, "Recovery snapshot")
  for (const key of RECOVERY_SNAPSHOT_KEYS) {
    if (key !== "targetJobs" && key !== "dueOccurrences" && !key.endsWith("Sha256")) {
      validateNonnegativeInteger(row[key], `Recovery snapshot ${key}`)
    }
  }
  for (const key of RECOVERY_SNAPSHOT_KEYS.filter((entry) => entry.endsWith("Sha256"))) {
    if (typeof row[key] !== "string" || !/^[a-f0-9]{64}$/.test(row[key])) {
      throw new Error("Recovery snapshot fingerprint is invalid")
    }
  }
  return { ...row, dueOccurrences: parseRecoveryDueOccurrences(row.dueOccurrences),
    targetJobs: validateTargetJobs(row.targetJobs) } as RecoverySnapshot
}
