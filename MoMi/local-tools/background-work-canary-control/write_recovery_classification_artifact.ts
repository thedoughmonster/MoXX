import { open, readFile } from "node:fs/promises"
import { join } from "node:path"

import { buildRecoveryClassificationArtifact } from "./build_recovery_classification_artifact.ts"
import { canonicalJson } from "./canonical_json.ts"
import { evaluateRecoveryPreflightInvariants } from "./evaluate_recovery_preflight_invariants.ts"
import { movePrivateFileExclusive } from "./move_private_file_exclusive.ts"
import type { ReceiptVerification } from "./receipt_types.ts"
import type { RecoveryClassificationTiming } from "./recovery_classification_types.ts"
import type { RecoverySnapshot, RecoveryState } from "./recovery_types.ts"
import { sha256Text } from "./sha256_text.ts"
import { syncDirectory } from "./sync_directory.ts"

export async function writeRecoveryClassificationArtifact(
  state: RecoveryState, sample: RecoverySnapshot, timing: RecoveryClassificationTiming,
  receipt: ReceiptVerification,
): Promise<{ path: string; sha256: string }> {
  const runtime = state.runtime
  const setup = runtime.setupReceipt
  const querySha256 = state.preflightQuerySha256
  const groups = evaluateRecoveryPreflightInvariants(sample)
  if (!querySha256 || !/^[a-f0-9]{64}$/.test(querySha256) ||
    !/^[a-f0-9]{40}$/.test(state.classificationReleaseTreeSha ?? "") ||
    setup.releaseSha !== runtime.repository.headSha || setup.status !== "ready" ||
    setup.stage !== "receipt" || setup.hostedMutationPossible !== false ||
    Object.values(groups).some(Boolean) || !state.preflightTiming || receipt.count < 3 ||
    receipt.lastHash !== state.receipt.lastHash || runtime.lock.status() !== "held" ||
    runtime.lock.lossSignal.aborted ||
    runtime.provider.status() !== "closed" || timing.endedAtUtcMs < timing.startedAtUtcMs ||
    timing.durationMs !== timing.endedAtUtcMs - timing.startedAtUtcMs ||
    state.preflightTiming.durationMs !== state.preflightTiming.endedAtUtcMs -
      state.preflightTiming.startedAtUtcMs ||
    state.preflightTiming.startedAtUtcMs < timing.startedAtUtcMs ||
    state.preflightTiming.endedAtUtcMs > timing.endedAtUtcMs) {
    throw new Error("Classification publication evidence is invalid")
  }
  const path = join(state.receipt.directory, "classification.json")
  const temporary = join(state.receipt.directory, ".classification.json.tmp")
  const body = `${canonicalJson(buildRecoveryClassificationArtifact(
    state, sample, timing, receipt,
  ))}\n`
  if (Buffer.byteLength(body, "utf8") > 32 * 1024) throw new Error("Receipt too large")
  const handle = await open(temporary, "wx", 0o600)
  let identity
  try { await handle.chmod(0o600); await handle.writeFile(body); await handle.sync()
    identity = await handle.stat() } finally { await handle.close() }
  await syncDirectory(state.receipt.directory)
  await movePrivateFileExclusive(temporary, path, state.receipt.directory, identity)
  const persisted = await readFile(path, "utf8")
  if (persisted !== body) throw new Error("Classification receipt changed")
  return { path, sha256: sha256Text(persisted) }
}
