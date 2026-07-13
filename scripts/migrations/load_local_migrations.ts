import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

export async function loadLocalMigrations(
  directory: string,
): Promise<Map<string, string>> {
  const sources = new Map<string, string>()
  const files = (await readdir(directory)).filter((file) => file.endsWith(".sql"))
  for (const file of files.sort()) {
    sources.set(file, await readFile(join(directory, file), "utf8"))
  }
  return sources
}
