import {
  GUARD_BOOTSTRAP_MARKER,
  GUARD_BOOTSTRAP_RESULT_KEYS,
} from "./guard_bootstrap_constants.ts"
import {
  DEADMAN_ADVISORY_LOCK_KEY,
  DEADMAN_EXPIRY_PLACEHOLDER,
} from "./deadman_command_constants.ts"
import { generateDeadmanCommand } from "./generate_deadman_command.ts"
import type { GuardBootstrapResult } from "./guard_bootstrap_types.ts"
import { md5Text } from "./md5_text.ts"
import { parseCliQueryEnvelope } from "./parse_cli_query_envelope.ts"
import {
  EXPECTED_GUARD_NAME,
  EXPECTED_GUARD_SCHEDULE,
  EXPECTED_TARGET_JOBS,
} from "./sample_constants.ts"
import { sha256Text } from "./sha256_text.ts"
import { validateNonnegativeInteger } from "./validate_nonnegative_integer.ts"
import { validateRunId } from "./validate_run_id.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"

export function parseGuardBootstrapOutput(
  output: Uint8Array,
  contextValue: unknown,
): GuardBootstrapResult {
  const context = validateStrictRecord(
    contextValue, ["runId", "generationSha256", "startCronRunId"],
    "Guard bootstrap parse context",
  )
  if (typeof context.runId !== "string") throw new Error("Guard bootstrap run ID is invalid")
  validateRunId(context.runId)
  validateNonnegativeInteger(context.startCronRunId, "Guard bootstrap baseline run ID")
  if (typeof context.generationSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(context.generationSha256)) {
    throw new Error("Guard bootstrap generation is invalid")
  }
  const row = validateStrictRecord(
    parseCliQueryEnvelope(output, GUARD_BOOTSTRAP_MARKER),
    GUARD_BOOTSTRAP_RESULT_KEYS,
    "Guard bootstrap result",
  )
  validateNonnegativeInteger(row.guardJobId, "Guard bootstrap job ID")
  const expiryPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/
  const expiryUtc = typeof row.expiryUtc === "string" ? row.expiryUtc : ""
  const millisecondExpiry = expiryUtc.replace(/(\.\d{3})\d{3}Z$/, "$1Z")
  const template = generateDeadmanCommand({
    runId: context.runId, generationSha256: context.generationSha256,
    startCronRunId: context.startCronRunId,
    guardName: EXPECTED_GUARD_NAME, guardSchedule: EXPECTED_GUARD_SCHEDULE,
    targetJobs: EXPECTED_TARGET_JOBS, advisoryLockKey: DEADMAN_ADVISORY_LOCK_KEY,
    expiryPlaceholder: DEADMAN_EXPIRY_PLACEHOLDER,
  })
  const command = template.replace(DEADMAN_EXPIRY_PLACEHOLDER, expiryUtc)
  if ((row.guardJobId as number) < 1 || row.guardName !== EXPECTED_GUARD_NAME ||
    row.guardSchedule !== EXPECTED_GUARD_SCHEDULE || row.guardActive !== true ||
    row.runId !== context.runId || row.generationSha256 !== context.generationSha256 ||
    !expiryPattern.test(expiryUtc) || Number.isNaN(Date.parse(expiryUtc)) ||
    new Date(expiryUtc).toISOString() !== millisecondExpiry ||
    row.commandSha256 !== sha256Text(command) || row.commandMd5 !== md5Text(command)) {
    throw new Error("Guard bootstrap result evidence is invalid")
  }
  return row as unknown as GuardBootstrapResult
}
