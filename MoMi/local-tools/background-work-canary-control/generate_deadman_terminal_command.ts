import {
  DEADMAN_TERMINAL_MARKER,
  DEADMAN_TERMINAL_STATUS,
} from "./deadman_command_constants.ts"
import type { DeadmanTerminalCommandInput } from "./deadman_terminal_types.ts"
import { validateRunId } from "./validate_run_id.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"

export function generateDeadmanTerminalCommand(value: unknown): string {
  const input = validateStrictRecord(value, [
    "runId", "generationSha256", "expiryUtc", "guardRunId", "guardStartUtc",
    "exactIdentityMask", "activeBeforeMask", "inactiveAfterMask",
    "originalCommandSha256", "originalCommandMd5",
  ], "Dead-man terminal command input")
  if (typeof input.runId !== "string") throw new Error("Terminal run ID is invalid")
  validateRunId(input.runId)
  for (const key of ["generationSha256", "originalCommandSha256"] as const) {
    if (typeof input[key] !== "string" || !/^[a-f0-9]{64}$/.test(input[key])) {
      throw new Error(`Terminal ${key} is invalid`)
    }
  }
  if (typeof input.originalCommandMd5 !== "string" ||
    !/^[a-f0-9]{32}$/.test(input.originalCommandMd5)) {
    throw new Error("Terminal original command MD5 is invalid")
  }
  for (const key of ["expiryUtc", "guardStartUtc"] as const) {
    if (typeof input[key] !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(input[key]) ||
      Number.isNaN(Date.parse(input[key]))) throw new Error(`Terminal ${key} is invalid`)
  }
  if (!Number.isSafeInteger(input.guardRunId) || (input.guardRunId as number) < 0) {
    throw new Error("Terminal guard run ID is invalid")
  }
  for (const key of ["exactIdentityMask", "activeBeforeMask", "inactiveAfterMask"] as const) {
    if (!Number.isSafeInteger(input[key]) || (input[key] as number) < 0 ||
      (input[key] as number) > 15) throw new Error(`Terminal ${key} is invalid`)
  }
  const typed = input as unknown as DeadmanTerminalCommandInput
  return [
    `select '${DEADMAN_TERMINAL_MARKER}'::text as marker,`,
    `  '${typed.runId}'::text as run_id,`,
    `  '${typed.generationSha256}'::text as generation_sha256,`,
    `  '${typed.expiryUtc}'::text as expiry_utc,`,
    `  ${typed.guardRunId}::bigint as guard_run_id,`,
    `  '${typed.guardStartUtc}'::text as guard_start_utc,`,
    `  '${DEADMAN_TERMINAL_STATUS}'::text as expected_terminal_status,`,
    `  ${typed.exactIdentityMask}::integer as exact_identity_mask,`,
    `  ${typed.activeBeforeMask}::integer as active_before_mask,`,
    `  ${typed.inactiveAfterMask}::integer as inactive_after_mask,`,
    `  '${typed.originalCommandSha256}'::text as original_command_sha256,`,
    `  '${typed.originalCommandMd5}'::text as original_command_md5;`,
    "",
  ].join("\n")
}
