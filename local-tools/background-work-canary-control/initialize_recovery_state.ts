import { randomBytes } from "node:crypto"

import { createSamplingIdentity } from "./create_sampling_identity.ts"
import { initializeReceipt } from "./initialize_receipt.ts"
import type { RecoveryState } from "./recovery_types.ts"
import type { ReleasedRuntime } from "./runtime_adapter_types.ts"

export async function initializeRecoveryState(
  runtime: ReleasedRuntime, repositoryRoot: string, receiptRoot: string,
  signal: AbortSignal,
): Promise<RecoveryState> {
  const identity = createSamplingIdentity(randomBytes)
  return { runtime, repositoryRoot, receiptRoot, signal,
    receipt: await initializeReceipt(receiptRoot, identity.runId),
    runId: identity.runId, generationSha256: identity.generationSha256,
    fastSamples: 0, resourceSamples: 0, zeroSamples: 0,
    lastProgress: 0, lastOutstandingWork: 0, lastProgressAtUtcMs: 0 }
}
