import { HeldNativeProviderOwner } from "./held_native_provider_owner.ts"
import type { BoundedChildResult } from "./process_types.ts"
import { resolvePinnedNativeCli } from "./resolve_pinned_native_cli.ts"
import { runBoundedChild } from "./run_bounded_child.ts"
import { snapshotNativeCli } from "./snapshot_native_cli.ts"

export async function runPinnedSupabaseLink(
  repositoryRoot: string,
): Promise<BoundedChildResult> {
  const owner = new HeldNativeProviderOwner(
    snapshotNativeCli(resolvePinnedNativeCli(repositoryRoot), "/tmp"),
    repositoryRoot,
    process.env,
    runBoundedChild,
  )
  try {
    await owner.verifyVersion()
    return await owner.linkProject()
  } finally {
    await owner.close()
  }
}
