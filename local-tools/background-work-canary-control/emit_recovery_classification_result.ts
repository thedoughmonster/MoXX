import { canonicalJson } from "./canonical_json.ts"
import type { RecoveryClassificationResult } from "./recovery_classification_types.ts"

export function emitRecoveryClassificationResult(result: RecoveryClassificationResult): void {
  if (result.envelope) process.stdout.write(`${canonicalJson(result.envelope)}\n`)
  if (result.stderrCode) process.stderr.write(`${result.stderrCode}\n`)
}
