import { spawn } from "node:child_process"

import { buildSafeChildEnvironment } from "./build_safe_child_environment.ts"
import {
  FLOCK_ARGUMENTS_PREFIX,
  LOCK_HOLDER_SCRIPT,
} from "./process_constants.ts"
import { monitorCanaryLockHolder } from "./monitor_canary_lock_holder.ts"
import { prepareCanaryLockFile } from "./prepare_canary_lock_file.ts"
import { resolveFlockExecutable } from "./resolve_flock_executable.ts"
import type { CanaryControlLock,
  CanaryLockProcessOptions } from "./process_types.ts"

export async function acquireCanaryControlLock(
  source: NodeJS.ProcessEnv = process.env,
  options: CanaryLockProcessOptions = {},
): Promise<CanaryControlLock> {
  const environment = buildSafeChildEnvironment(source)
  const flockPath = await resolveFlockExecutable(environment)
  const lockPath = await prepareCanaryLockFile(environment)
  let child
  try {
    child = spawn(flockPath, [
      ...FLOCK_ARGUMENTS_PREFIX,
      lockPath,
      process.execPath,
      "-e",
      options.holderScript ?? LOCK_HOLDER_SCRIPT,
    ], {
      env: environment,
      shell: false,
      stdio: ["pipe", "pipe", "ignore"],
      windowsHide: true,
    })
  } catch {
    throw new Error("Canary control lock holder failed to start")
  }
  return await monitorCanaryLockHolder(
    child, flockPath, lockPath, options.releaseTimeoutMs,
  )
}
