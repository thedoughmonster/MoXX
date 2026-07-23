import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import { canonicalJson } from "../dev_loop/canonical_json.ts"
import type { ReleaseReceipt } from "./types.ts"

export function writeReleaseReceipt(receipt: ReleaseReceipt): string {
  const directory = join(workspaceRoot, ".momi", "releases")
  const path = join(directory, `${receipt.environment}-${receipt.head_sha}.json`)
  mkdirSync(directory, { recursive: true })
  writeFileSync(path, `${canonicalJson(receipt)}\n`)
  return path
}
