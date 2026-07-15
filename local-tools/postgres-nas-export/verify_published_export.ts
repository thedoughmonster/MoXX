import { validateDump } from "./validate_dump.ts"
import { validateGzip } from "./validate_gzip.ts"
import { verifyArchive } from "./verify_archive.ts"
import type { EnvironmentName, VerifiedArchive } from "./types.ts"

export async function verifyPublishedExport(
  target: string,
  archiveId: string,
  environment: EnvironmentName,
  projectRef: string,
  pgRestore: string,
): Promise<VerifiedArchive> {
  const verified = await verifyArchive(target, archiveId, environment, projectRef)
  validateDump(pgRestore, verified.dumpPath)
  await validateGzip(verified.sourcePath)
  await validateGzip(verified.warehousePath)
  return verified
}
