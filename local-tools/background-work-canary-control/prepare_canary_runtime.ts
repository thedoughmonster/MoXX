import { acquireCanaryControlLock } from "./acquire_canary_control_lock.ts"
import { claimSetupReceipt } from "./claim_setup_receipt.ts"
import { collectRuntimeEvidence } from "./collect_runtime_evidence.ts"
import { createHeldNativeProvider } from "./create_held_native_provider.ts"
import { prepareReceiptRoot } from "./prepare_receipt_root.ts"
import { prepareReleasedRuntime } from "./prepare_released_runtime.ts"
import { recordValidationPreflightFailure } from "./record_validation_preflight_failure.ts"
import { resolveRuntimeExecutables } from "./resolve_runtime_executables.ts"
import { runBoundedChild } from "./run_bounded_child.ts"
import { selfTestFlockCapability } from "./self_test_flock_capability.ts"
import type { ReleasedRuntime } from "./runtime_adapter_types.ts"
import { validateCanonicalLinkage } from "./validate_canonical_linkage.ts"

export async function prepareCanaryRuntime(
  args: string[], repositoryRoot: string,
): Promise<ReleasedRuntime> {
  const startedMs = Date.now()
  try {
    return await prepareReleasedRuntime(args, repositoryRoot, {
      environment: process.env, nodeVersion: process.versions.node,
      runChild: runBoundedChild, resolveExecutables: resolveRuntimeExecutables,
      collectEvidence: collectRuntimeEvidence,
      acquireLock: acquireCanaryControlLock,
      createProvider: createHeldNativeProvider, testFlock: selfTestFlockCapability,
      validateLinkage: validateCanonicalLinkage, prepareReceiptRoot,
      claimReceipt: claimSetupReceipt, nowMs: () => Date.now(),
    })
  } catch (error) {
    try { await recordValidationPreflightFailure(error, startedMs, Date.now()) } catch {
      /* the original fail-closed preflight error remains authoritative */
    }
    throw error
  }
}
