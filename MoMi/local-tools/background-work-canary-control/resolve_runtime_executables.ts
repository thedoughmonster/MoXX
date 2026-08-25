import { delimiter, isAbsolute, join } from "node:path"
import { lstat } from "node:fs/promises"
import { buildSafeChildEnvironment } from "./build_safe_child_environment.ts"
import { resolveFlockExecutable } from "./resolve_flock_executable.ts"
import { resolveSafeExecutable } from "./resolve_safe_executable.ts"
import type { PreflightExecutables } from "./runtime_adapter_types.ts"

export async function resolveRuntimeExecutables(
  source: NodeJS.ProcessEnv = process.env,
): Promise<PreflightExecutables> {
  const environment = buildSafeChildEnvironment(source)
  const directories = environment.PATH?.split(delimiter) ?? []
  if (directories.length === 0 || directories.some((path) => !path || !isAbsolute(path))) {
    throw new Error("Runtime executable PATH is unavailable or unsafe")
  }
  const found: Record<string, string> = {}
  for (const name of ["git", "pnpm"] as const) {
    for (const directory of directories) {
      const candidate = join(directory, name)
      try {
        await lstat(candidate)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue
        throw new Error("Runtime executable path is unavailable or unsafe")
      }
      try {
        found[name] = await resolveSafeExecutable(candidate)
        break
      } catch {
        throw new Error("Runtime executable path is unavailable or unsafe")
      }
    }
    if (!found[name]) throw new Error("Runtime executable path is unavailable or unsafe")
  }
  return {
    gitExecutable: found.git,
    pnpmExecutable: found.pnpm,
    flockExecutable: await resolveFlockExecutable(environment),
  }
}
