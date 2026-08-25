import { FLOCK_ARGUMENTS_PREFIX } from "./process_constants.ts"
import type { BoundedChildResult } from "./process_types.ts"
import { runBoundedChild } from "./run_bounded_child.ts"

export async function runFlockSelfTestProbe(
  flockPath: string,
  lockPath: string,
): Promise<BoundedChildResult> {
  return await runBoundedChild({
    executable: flockPath,
    arguments: [...FLOCK_ARGUMENTS_PREFIX, lockPath, process.execPath, "-e", ""],
    environment: process.env,
    timeoutMs: 2_000,
  })
}
