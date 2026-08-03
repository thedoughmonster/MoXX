import type { RecoveryDueOccurrence } from "./recovery_types.ts"
import { validateNonnegativeInteger } from "./validate_nonnegative_integer.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"

export function parseRecoveryDueOccurrences(value: unknown): readonly RecoveryDueOccurrence[] {
  if (!Array.isArray(value) || value.length > 128) {
    throw new Error("Recovery due occurrences are invalid")
  }
  const parsed = value.map((entry) => {
    const row = validateStrictRecord(entry, ["scheduleKey", "dueAtUtcMs"],
      "Recovery due occurrence")
    if (typeof row.scheduleKey !== "string" || row.scheduleKey.length < 1 ||
      row.scheduleKey.length > 256 || /[^a-zA-Z0-9._:-]/.test(row.scheduleKey)) {
      throw new Error("Recovery due occurrence schedule key is invalid")
    }
    return { scheduleKey: row.scheduleKey,
      dueAtUtcMs: validateNonnegativeInteger(row.dueAtUtcMs,
        "Recovery due occurrence timestamp") }
  })
  const keys = parsed.map((row) => `${row.scheduleKey}\0${row.dueAtUtcMs}`)
  if (new Set(keys).size !== keys.length ||
    keys.some((key, index) => index > 0 && key <= keys[index - 1]!)) {
    throw new Error("Recovery due occurrences are not canonical")
  }
  return parsed
}
