import { readFileSync } from "node:fs"
import { join } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import { hashText } from "./hash_text.ts"

export function hashFiles(paths: string[]): Array<{ path: string; sha256: string }> {
  return [...paths].sort().map((path) => ({
    path,
    sha256: hashText(readFileSync(join(workspaceRoot, path), "utf8")),
  }))
}
