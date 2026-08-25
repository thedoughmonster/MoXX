import { canonicalJson } from "./canonical_json.ts"
import type { RecoveryResult } from "./recovery_types.ts"

export function emitRecoveryResult(result: RecoveryResult): void {
  if (result.envelope) process.stdout.write(`${canonicalJson(result.envelope)}\n`)
  if (result.stderrCode) process.stderr.write(`${result.stderrCode}\n`)
}
