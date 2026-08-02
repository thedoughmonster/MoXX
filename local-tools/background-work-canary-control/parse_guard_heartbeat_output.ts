import {
  GUARD_HEARTBEAT_MARKER,
  GUARD_HEARTBEAT_RESULT_KEYS,
} from "./guard_heartbeat_constants.ts"
import {
  DEADMAN_ADVISORY_LOCK_KEY,
  DEADMAN_EXPIRY_PLACEHOLDER,
} from "./deadman_command_constants.ts"
import { generateDeadmanCommand } from "./generate_deadman_command.ts"
import type { GuardHeartbeatResult } from "./guard_heartbeat_types.ts"
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

export function parseGuardHeartbeatOutput(
  output: Uint8Array,
  contextValue: unknown,
): GuardHeartbeatResult {
  const context = validateStrictRecord(contextValue, [
    "runId", "guardJobId", "previousGenerationSha256", "nextGenerationSha256",
    "startCronRunId",
  ], "Guard heartbeat parse context")
  if (typeof context.runId !== "string") throw new Error("Guard heartbeat run ID is invalid")
  validateRunId(context.runId)
  validateNonnegativeInteger(context.guardJobId, "Guard heartbeat job ID")
  validateNonnegativeInteger(context.startCronRunId, "Guard heartbeat baseline run ID")
  if ((context.guardJobId as number) < 1 ||
    typeof context.previousGenerationSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(context.previousGenerationSha256) ||
    typeof context.nextGenerationSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(context.nextGenerationSha256) ||
    context.previousGenerationSha256 === context.nextGenerationSha256) {
    throw new Error("Guard heartbeat parse context is invalid")
  }
  const row = validateStrictRecord(
    parseCliQueryEnvelope(output, GUARD_HEARTBEAT_MARKER),
    GUARD_HEARTBEAT_RESULT_KEYS,
    "Guard heartbeat result",
  )
  validateNonnegativeInteger(row.guardJobId, "Guard heartbeat result job ID")
  const expiry = typeof row.expiryUtc === "string" ? row.expiryUtc : ""
  const milliseconds = expiry.replace(/(\.\d{3})\d{3}Z$/, "$1Z")
  const template = generateDeadmanCommand({
    runId: context.runId, generationSha256: context.nextGenerationSha256,
    startCronRunId: context.startCronRunId,
    guardName: EXPECTED_GUARD_NAME, guardSchedule: EXPECTED_GUARD_SCHEDULE,
    targetJobs: EXPECTED_TARGET_JOBS, advisoryLockKey: DEADMAN_ADVISORY_LOCK_KEY,
    expiryPlaceholder: DEADMAN_EXPIRY_PLACEHOLDER,
  })
  const command = template.replace(DEADMAN_EXPIRY_PLACEHOLDER, expiry)
  if (row.guardJobId !== context.guardJobId || row.guardName !== EXPECTED_GUARD_NAME ||
    row.guardSchedule !== EXPECTED_GUARD_SCHEDULE || row.guardActive !== true ||
    row.runId !== context.runId ||
    row.previousGenerationSha256 !== context.previousGenerationSha256 ||
    row.nextGenerationSha256 !== context.nextGenerationSha256 ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(expiry) ||
    Number.isNaN(Date.parse(expiry)) || new Date(expiry).toISOString() !== milliseconds ||
    row.commandSha256 !== sha256Text(command) || row.commandMd5 !== md5Text(command)) {
    throw new Error("Guard heartbeat result evidence is invalid")
  }
  return row as unknown as GuardHeartbeatResult
}
