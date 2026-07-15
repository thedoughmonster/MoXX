import { MANUAL_DIRECTORY } from "./constants.ts"
import type { ArchiveFile } from "./types.ts"
import { validateArchivePath } from "./validate_archive_path.ts"
import { validateFileMetadata } from "./validate_file_metadata.ts"

export function validateManualRecords(value: unknown): ArchiveFile[] {
  if (!Array.isArray(value)) throw new Error("Manual file metadata must be an array")
  const records: ArchiveFile[] = []
  for (const item of value) {
    if (!item || typeof item !== "object" ||
      JSON.stringify(Object.keys(item).sort()) !== JSON.stringify(["bytes", "file", "sha256"])) {
      throw new Error("Manual file metadata contains missing or unknown fields")
    }
    const record = validateFileMetadata(item, 0)
    validateArchivePath(record.file, MANUAL_DIRECTORY)
    records.push(record)
  }
  const names = records.map((record) => record.file)
  if (JSON.stringify(names) !== JSON.stringify([...names].sort()) ||
    new Set(names.map((name) => name.toLowerCase())).size !== names.length) {
    throw new Error("Manual file paths must be sorted and unique")
  }
  return records
}
