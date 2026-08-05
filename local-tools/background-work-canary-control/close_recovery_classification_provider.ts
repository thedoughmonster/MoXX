import type { ReleasedRuntime } from "./runtime_adapter_types.ts"

export async function closeRecoveryClassificationProvider(
  runtime: ReleasedRuntime,
): Promise<void> {
  await runtime.provider.close()
  if (runtime.provider.status() !== "closed") {
    throw new Error("Classification provider did not close")
  }
}
