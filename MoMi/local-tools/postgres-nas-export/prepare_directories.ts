import { lstat, mkdir } from "node:fs/promises"
import { join } from "node:path"

import { ARCHIVES_DIRECTORY, CONTROL_DIRECTORY } from "./constants.ts"

export async function prepareDirectories(target: string): Promise<void> {
  const directories = [
    join(target, CONTROL_DIRECTORY),
    join(target, CONTROL_DIRECTORY, "runs"),
    join(target, CONTROL_DIRECTORY, "staging"),
    join(target, ARCHIVES_DIRECTORY),
    join(target, "drills"),
  ]
  for (const directory of directories) {
    await mkdir(directory, { recursive: true })
    const info = await lstat(directory)
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new Error("NAS control and archive paths must be non-symlink directories")
    }
  }
}
