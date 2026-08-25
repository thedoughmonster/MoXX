import type { ReleasedRuntime } from "./runtime_adapter_types.ts"

export async function closeRecoveryClassificationControls(
  runtime: ReleasedRuntime,
): Promise<void> {
  let failed = false
  try { await runtime.lock.release() } catch {
    failed = true
    runtime.lock.retainUntilExit?.()
  }
  try { await runtime.provider.close() } catch { failed = true }
  try {
    if (runtime.lock.status() !== "released" || runtime.provider.status() !== "closed") {
      failed = true
    }
  } catch { failed = true }
  if (failed) throw new Error("Classification controls did not close safely")
}
