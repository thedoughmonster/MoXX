import { readdir } from "node:fs/promises"
import { join } from "node:path"

export async function collectTypeScriptFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true })
  const paths: string[] = []

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) {
      continue
    }
    paths.push(join(entry.parentPath, entry.name))
  }

  return paths.sort()
}
