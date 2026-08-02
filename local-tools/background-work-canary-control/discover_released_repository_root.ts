import { lstatSync, realpathSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export function discoverReleasedRepositoryRoot(moduleUrl: string): string {
  const candidate = resolve(dirname(fileURLToPath(moduleUrl)), "../..")
  const actual = realpathSync(candidate)
  const info = lstatSync(candidate)
  if (actual !== candidate || !info.isDirectory() || info.isSymbolicLink()) {
    throw new Error("Released repository root is unavailable")
  }
  return candidate
}
