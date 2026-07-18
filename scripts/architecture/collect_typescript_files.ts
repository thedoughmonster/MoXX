import { readdir } from "node:fs/promises"
import { join } from "node:path"

const allowedExtensions = [".ts", ".json", ".md"]

export async function collectTypeScriptFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true })
  const paths: string[] = []

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      throw new Error(`${join(entry.parentPath, entry.name)}: service source must not be a symlink`)
    }
    if (entry.isFile() && !allowedExtensions.some((extension) =>
      entry.name.endsWith(extension)
    )) {
      throw new Error(
        `${join(entry.parentPath, entry.name)}: unsupported service source asset`,
      )
    }
    if (!entry.isFile() || !entry.name.endsWith(".ts")) {
      continue
    }
    paths.push(join(entry.parentPath, entry.name))
  }

  return paths.sort()
}
