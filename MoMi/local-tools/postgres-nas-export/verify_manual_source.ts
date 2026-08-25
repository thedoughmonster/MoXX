import { scanManualSource } from "./scan_manual_source.ts"
import type { ArchiveFile } from "./types.ts"

export async function verifyManualSource(
  directory: string,
  repositoryRoot: string,
  expected: ArchiveFile[],
): Promise<void> {
  const scanned = await scanManualSource(directory, repositoryRoot)
  const actual = scanned.map(({ file, bytes, sha256 }) => ({ file, bytes, sha256 }))
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("Manual export source no longer matches the resumable checkpoint")
  }
}
