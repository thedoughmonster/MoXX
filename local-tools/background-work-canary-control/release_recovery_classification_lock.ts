import type { ReleasedRuntime } from "./runtime_adapter_types.ts"

export async function releaseRecoveryClassificationLock(
  runtime: ReleasedRuntime,
): Promise<void> {
  await runtime.lock.release()
  if (runtime.lock.status() !== "released" || runtime.lock.lossSignal.aborted) {
    throw new Error("Classification lifecycle lock release was not acknowledged")
  }
}
