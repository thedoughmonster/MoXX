import { basename } from "node:path"
import { retentionMigrations } from "./policy.ts"

export function assertRetentionAppliedSources(
  versions: string[], rows: { version: string; name: string; sha256: string }[],
): void {
  if (rows.length !== versions.length || rows.some((row, index) => {
    const pin = retentionMigrations[versions[index]]
    return !pin || row.version !== versions[index] ||
      row.name !== basename(pin.file).slice(15, -4) || row.sha256 !== pin.sha256
  })) throw new Error("Applied retention migration source differs from the pinned source")
}
