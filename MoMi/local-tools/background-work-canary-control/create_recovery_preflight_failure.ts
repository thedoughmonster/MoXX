import { canonicalJson } from "./canonical_json.ts"
import type { RecoveryPreflightFailure } from "./recovery_preflight_failure_types.ts"
import { sha256Text } from "./sha256_text.ts"

export function createRecoveryPreflightFailure(
  input: Omit<RecoveryPreflightFailure, "failureFingerprint">,
): RecoveryPreflightFailure {
  const fingerprint = sha256Text(canonicalJson({ stage: input.stage,
    reason_category: input.reasonCategory, query_sha256: input.querySha256,
    child_exit_code: input.childExitCode ?? null,
    provider_category: input.providerCategory ?? null,
    parse_subreason: input.parseEvidence?.subreason ?? null,
    invariant_groups: input.invariantGroups ?? null }))
  return Object.freeze({ ...input, failureFingerprint: fingerprint })
}
