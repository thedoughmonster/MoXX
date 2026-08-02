import {
  PROGRAM_EXIT_MANUAL,
  PROGRAM_EXIT_PRE_GUARD,
  PROGRAM_STDERR_MANUAL,
  PROGRAM_STDERR_PRE_GUARD,
} from "./program_constants.ts"
import type { CanaryProgramResult } from "./program_types.ts"

export function buildProgramFailure(
  stage: "manual" | "pre_guard",
): CanaryProgramResult {
  return stage === "manual"
    ? { exitCode: PROGRAM_EXIT_MANUAL,
        stderrCode: PROGRAM_STDERR_MANUAL, envelope: null }
    : { exitCode: PROGRAM_EXIT_PRE_GUARD,
        stderrCode: PROGRAM_STDERR_PRE_GUARD, envelope: null }
}
