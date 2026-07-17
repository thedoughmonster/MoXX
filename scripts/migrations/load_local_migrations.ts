import { lstat, readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

export async function loadLocalMigrations(
  directory: string,
): Promise<Map<string, string>> {
  const sources = new Map<string, string>()
  const entries = (await readdir(directory, { withFileTypes: true }))
    .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)
  for (const entry of entries) {
    if (entry.isDirectory()) {
      throw new Error(`${entry.name}: migration inventory must be flat`)
    }
    if (entry.name !== "AGENTS.md" && !entry.name.endsWith(".sql")) {
      throw new Error(`${entry.name}: unexpected migration inventory entry`)
    }
    if (!entry.isFile()) {
      throw new Error(`${entry.name}: migration must be a regular file`)
    }
    const path = join(directory, entry.name)
    const metadata = await lstat(path)
    if (!metadata.isFile()) {
      throw new Error(`${entry.name}: migration must be a regular file`)
    }
    if ((metadata.mode & 0o111) !== 0) {
      throw new Error(`${entry.name}: migration must not be executable`)
    }
    if (entry.name === "AGENTS.md") continue
    if (sources.has(entry.name)) {
      throw new Error(`${entry.name}: duplicate migration path`)
    }
    sources.set(entry.name, await readFile(path, "utf8"))
  }
  return sources
}
