import { readFileSync } from "node:fs"
import { join } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import type { DevelopmentMigrationCorrection } from
  "./find_migration_history_violations.ts"

interface CorrectionRecord {
  migration: string
  replacement_migration?: string
  from_blob_sha1: string
  to_blob_sha1: string
  issue: number
  reason: string
  hosted_dev_status: "absent"
  verified_at: string
}

interface CorrectionLedger {
  schema_version: 1
  corrections: CorrectionRecord[]
}

const sha = /^[0-9a-f]{40}$/
const migration = /^\d{14}_[a-z0-9_]+\.sql$/

export function loadDevelopmentMigrationCorrections():
  Map<string, DevelopmentMigrationCorrection> {
  const path = join(
    workspaceRoot,
    "docs/verification/development-migration-corrections.json",
  )
  const parsed = JSON.parse(readFileSync(path, "utf8")) as CorrectionLedger
  if (parsed.schema_version !== 1 || !Array.isArray(parsed.corrections)) {
    throw new Error("Invalid development migration correction ledger")
  }
  const result = new Map<string, DevelopmentMigrationCorrection>()
  for (const entry of parsed.corrections) {
    const replacement = entry.replacement_migration
    const isRename = replacement !== undefined
    if (
      !migration.test(entry.migration) || !sha.test(entry.from_blob_sha1) ||
      !sha.test(entry.to_blob_sha1) ||
      (isRename && (!migration.test(replacement) ||
        replacement === entry.migration ||
        entry.from_blob_sha1 !== entry.to_blob_sha1)) ||
      (!isRename && entry.from_blob_sha1 === entry.to_blob_sha1) ||
      !Number.isInteger(entry.issue) || entry.issue < 1 ||
      entry.hosted_dev_status !== "absent" || !entry.reason.trim() ||
      Number.isNaN(Date.parse(entry.verified_at)) || result.has(entry.migration)
    ) throw new Error(`Invalid migration correction: ${entry.migration}`)
    result.set(entry.migration, {
      from: `git-blob-sha1:${entry.from_blob_sha1}`,
      to: `git-blob-sha1:${entry.to_blob_sha1}`,
      replacement,
    })
  }
  return result
}
