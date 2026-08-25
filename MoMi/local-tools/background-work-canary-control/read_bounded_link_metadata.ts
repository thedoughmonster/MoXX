import { lstatSync } from "node:fs"

import { readBoundedRegularFile } from "./read_bounded_regular_file.ts"
import { SetupPreflightError } from "./setup_preflight_error.ts"

export function readBoundedLinkMetadata(path: string, maxBytes: number): string {
  try {
    const info = lstatSync(path)
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw new Error()
    return readBoundedRegularFile(path, maxBytes)
  } catch {
    throw new SetupPreflightError("LinkageMetadataUnsafe", "linkage")
  }
}
