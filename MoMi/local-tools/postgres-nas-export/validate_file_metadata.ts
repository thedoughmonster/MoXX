import type { ArchiveFile } from "./types.ts"

export function validateFileMetadata(value: unknown, minimumBytes: number): ArchiveFile {
  if (!value || typeof value !== "object") throw new Error("File metadata is invalid")
  const file = value as Partial<ArchiveFile>
  if (typeof file.file !== "string" || !Number.isSafeInteger(file.bytes) ||
    (file.bytes ?? -1) < minimumBytes || typeof file.sha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(file.sha256)) {
    throw new Error("File size or SHA-256 metadata is invalid")
  }
  return file as ArchiveFile
}
