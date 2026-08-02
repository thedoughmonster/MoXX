import { spawn } from "node:child_process"

import { buildSafeChildEnvironment } from "./build_safe_child_environment.ts"
import { FLOCK_ARGUMENTS_PREFIX } from "./process_constants.ts"
import type { CanaryControlLock } from "./process_types.ts"
import { monitorCanaryLockHolder } from "./monitor_canary_lock_holder.ts"
import { FLOCK_SELF_TEST_HOLDER_SCRIPT } from "./setup_preflight_constants.ts"

export async function acquireFlockSelfTestHolder(
  flockPath: string,
  lockPath: string,
): Promise<CanaryControlLock> {
  const child = spawn(flockPath, [
    ...FLOCK_ARGUMENTS_PREFIX, lockPath, process.execPath, "-e",
    FLOCK_SELF_TEST_HOLDER_SCRIPT,
  ], {
    env: buildSafeChildEnvironment(process.env), shell: false,
    stdio: ["pipe", "pipe", "ignore"], windowsHide: true,
  })
  return await monitorCanaryLockHolder(child, flockPath, lockPath)
}
