import { lstat } from "node:fs/promises"
import { join } from "node:path"

import { DUMP_FILE, SOURCE_EXPORT_FILE, WAREHOUSE_EXPORT_FILE } from "./constants.ts"
import { validateDump } from "./validate_dump.ts"
import { validateGzip } from "./validate_gzip.ts"

export async function validateStagedExport(pgRestore: string, staging: string): Promise<void> {
  const dumpPath = join(staging, DUMP_FILE)
  const sourcePath = join(staging, SOURCE_EXPORT_FILE)
  const warehousePath = join(staging, WAREHOUSE_EXPORT_FILE)
  for (const path of [dumpPath, sourcePath, warehousePath]) {
    const info = await lstat(path)
    if (!info.isFile() || info.isSymbolicLink() || info.size < 1) {
      throw new Error("Staged database artifact is unsafe or empty")
    }
  }
  validateDump(pgRestore, dumpPath)
  await validateGzip(sourcePath)
  await validateGzip(warehousePath)
}
