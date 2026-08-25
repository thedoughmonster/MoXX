import { open, readFile } from "node:fs/promises"
import { join } from "node:path"

import { canonicalJson } from "./canonical_json.ts"
import { movePrivateFileExclusive } from "./move_private_file_exclusive.ts"
import type { ReceiptVerification } from "./receipt_types.ts"
import type { RecoveryPreflightFailure } from "./recovery_preflight_failure_types.ts"
import type { RecoveryState } from "./recovery_types.ts"
import { sha256Text } from "./sha256_text.ts"
import { syncDirectory } from "./sync_directory.ts"

export async function writeRecoveryPreflightFailure(
  state: RecoveryState, failure: RecoveryPreflightFailure,
  receipt: ReceiptVerification,
): Promise<{ path: string; sha256: string }> {
  const path = join(state.receipt.directory, "preflight-failure.json")
  const temporary = join(state.receipt.directory, ".preflight-failure.json.tmp")
  const body = canonicalJson({ schema_version: 1, run_id: state.runId,
    project_ref: state.runtime.options.projectRef,
    release_sha: state.runtime.repository.headSha,
    terminal_class: "PRE_GUARD_FAILURE", disposition: "pre_guard_failure",
    stage: failure.stage, reason_category: failure.reasonCategory,
    duration_ms: failure.durationMs, query_sha256: failure.querySha256,
    failure_fingerprint: failure.failureFingerprint,
    child_exit_code: failure.childExitCode ?? null,
    provider_category: failure.providerCategory ?? null,
    parse_schema: failure.parseEvidence ? {
      subreason: failure.parseEvidence.subreason,
      top_level_type: failure.parseEvidence.topLevelType,
      row_count: failure.parseEvidence.rowCount,
      outer_unexpected_key_count: failure.parseEvidence.outerUnexpectedKeyCount,
      sample_unexpected_key_count: failure.parseEvidence.sampleUnexpectedKeyCount,
    } : null,
    invariant_groups: failure.invariantGroups ?? null,
    receipt_chain: { record_count: receipt.count, last_hash: receipt.lastHash },
    effects: { provider_query_read_only: true, provider_mutation_possible: false,
      guard_created: false, targets_activated: false, durable_work_mutated: false,
      production_accessed: false, cleanup_performed: false },
  }) + "\n"
  if (Buffer.byteLength(body, "utf8") > 16 * 1024) throw new Error("Failure receipt too large")
  const handle = await open(temporary, "wx", 0o600)
  let identity
  try { await handle.chmod(0o600); await handle.writeFile(body); await handle.sync()
    identity = await handle.stat() } finally { await handle.close() }
  await syncDirectory(state.receipt.directory)
  await movePrivateFileExclusive(temporary, path, state.receipt.directory, identity)
  const persisted = await readFile(path, "utf8")
  if (persisted !== body) throw new Error("Failure receipt changed during publication")
  return { path, sha256: sha256Text(persisted) }
}
