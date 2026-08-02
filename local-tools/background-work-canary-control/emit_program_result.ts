import { canonicalJson } from "./canonical_json.ts"
import type { CanaryProgramResult, ProgramIo } from "./program_types.ts"

export function emitProgramResult(
  result: CanaryProgramResult,
  io: ProgramIo,
): void {
  if (result.envelope) io.stdout(`${canonicalJson(result.envelope)}\n`)
  if (result.stderrCode) io.stderr(`${result.stderrCode}\n`)
}
