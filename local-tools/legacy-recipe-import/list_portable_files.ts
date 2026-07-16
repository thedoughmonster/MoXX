import { readdir } from "node:fs/promises"
import { join, relative, sep } from "node:path"

export async function listPortableFiles(portableRoot: string): Promise<string[]> {
  const entries = await readdir(portableRoot, { recursive: true, withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      throw new Error("Portable packages cannot contain links or junctions")
    }
    if (!entry.isFile()) continue
    files.push(relative(portableRoot, join(entry.parentPath, entry.name)).replaceAll(sep, "/"))
  }
  return files.sort()
}
