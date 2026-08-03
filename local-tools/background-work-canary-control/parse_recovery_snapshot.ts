import { RECOVERY_SNAPSHOT_KEYS } from "./recovery_snapshot_keys.ts"
import type { RecoverySnapshot } from "./recovery_types.ts"
import { validateNonnegativeInteger } from "./validate_nonnegative_integer.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"
import { validateTargetJobs } from "./validate_target_jobs.ts"

export function parseRecoverySnapshot(value: unknown): RecoverySnapshot {
  const row = validateStrictRecord(value, RECOVERY_SNAPSHOT_KEYS, "Recovery snapshot")
  for (const key of RECOVERY_SNAPSHOT_KEYS) {
    if (key !== "targetJobs" && key !== "registrySha256" &&
      key !== "scheduleDueSha256" && key !== "toastSha256") {
      validateNonnegativeInteger(row[key], `Recovery snapshot ${key}`)
    }
  }
  if (typeof row.registrySha256 !== "string" ||
    typeof row.scheduleDueSha256 !== "string" || typeof row.toastSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(row.registrySha256) ||
    !/^[a-f0-9]{64}$/.test(row.scheduleDueSha256) ||
    !/^[a-f0-9]{64}$/.test(row.toastSha256)) {
    throw new Error("Recovery snapshot fingerprint is invalid")
  }
  return { ...row, targetJobs: validateTargetJobs(row.targetJobs) } as RecoverySnapshot
}
