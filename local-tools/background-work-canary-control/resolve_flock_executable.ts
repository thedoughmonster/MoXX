import { delimiter, isAbsolute, join } from "node:path"
import { lstat } from "node:fs/promises"

import { buildChildEnvironment } from "./build_child_environment.ts"
import { resolveSafeExecutable } from "./resolve_safe_executable.ts"

export async function resolveFlockExecutable(
  source: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const path = buildChildEnvironment(source).PATH
  if (!path) throw new Error("flock executable is unavailable or unsafe")
  const directories = path.split(delimiter)
  if (directories.some((directory) => !directory || !isAbsolute(directory))) {
    throw new Error("flock executable is unavailable or unsafe")
  }
  for (const directory of directories) {
    const candidate = join(directory, "flock")
    try {
      await lstat(candidate)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue
      throw new Error("flock executable is unavailable or unsafe")
    }
    try {
      return await resolveSafeExecutable(candidate)
    } catch {
      throw new Error("flock executable is unavailable or unsafe")
    }
  }
  throw new Error("flock executable is unavailable or unsafe")
}
