import { HeldNativeProviderOwner } from "./held_native_provider_owner.ts"
import { resolvePinnedNativeCli } from "./resolve_pinned_native_cli.ts"
import type { BoundedChildRunner, HeldProvider } from "./runtime_adapter_types.ts"
import { snapshotNativeCli } from "./snapshot_native_cli.ts"

export async function createHeldNativeProvider(
  repositoryRoot: string,
  environment: NodeJS.ProcessEnv,
  runChild: BoundedChildRunner,
): Promise<HeldProvider> {
  const snapshot = snapshotNativeCli(resolvePinnedNativeCli(repositoryRoot), "/tmp")
  const owner = new HeldNativeProviderOwner(
    snapshot, repositoryRoot, environment, runChild,
  )
  try {
    await owner.verifyVersion()
    return Object.freeze({
      runQuery: owner.runQuery.bind(owner),
      status: owner.status.bind(owner),
      close: owner.close.bind(owner),
    })
  } catch (error) {
    try { await owner.close() } catch { /* original preflight failure is authoritative */ }
    throw error
  }
}
