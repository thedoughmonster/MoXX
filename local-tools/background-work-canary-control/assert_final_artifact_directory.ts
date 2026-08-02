import { lstat, readdir } from "node:fs/promises"

export async function assertFinalArtifactDirectory(
  path: string,
  expectedEntries: readonly string[],
): Promise<void> {
  const info = await lstat(path)
  const entries = (await readdir(path)).sort()
  if (!info.isDirectory() || info.isSymbolicLink() ||
    (info.mode & 0o777) !== 0o700 ||
    entries.join(",") !== [...expectedEntries].sort().join(",")) {
    throw new Error("Final artifact directory is unsafe")
  }
}
