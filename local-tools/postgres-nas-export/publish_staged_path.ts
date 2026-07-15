import { lstat, rename } from "node:fs/promises"

export async function publishStagedPath(
  staged: string,
  published: string,
  kind: "file" | "directory",
): Promise<void> {
  let stagedInfo
  let publishedInfo
  try { stagedInfo = await lstat(staged) } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  try { publishedInfo = await lstat(published) } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  if (stagedInfo && publishedInfo) throw new Error("Staged and published archive paths both exist")
  if (!stagedInfo && !publishedInfo) throw new Error("Required staged or published archive path is missing")
  for (const info of [stagedInfo, publishedInfo]) {
    if (!info) continue
    const matches = kind === "file" ? info.isFile() : info.isDirectory()
    if (!matches || info.isSymbolicLink()) throw new Error("Archive publication path is unsafe")
  }
  if (stagedInfo) await rename(staged, published)
}
