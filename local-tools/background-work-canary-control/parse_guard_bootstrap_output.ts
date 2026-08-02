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
import { decodeCliQueryEnvelope } from "./decode_cli_query_envelope.ts"
import { EMPTY_PROVIDER_OBSERVED_SHAPE } from "./provider_parse_diagnostic.ts"
import { ProviderSchemaError } from "./provider_schema_error.ts"
import {
  EXPECTED_GUARD_NAME,
  EXPECTED_GUARD_SCHEDULE,
  EXPECTED_TARGET_JOBS,
} from "./sample_constants.ts"
import { sha256Text } from "./sha256_text.ts"
import { validateRunId } from "./validate_run_id.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"

export function parseGuardBootstrapOutput(
  output: Uint8Array,
  contextValue: unknown,
): GuardBootstrapResult {
  let context: Record<string, unknown>
  try {
    context = validateStrictRecord(
      contextValue, ["runId", "generationSha256", "startCronRunId"],
      "Guard bootstrap parse context",
    )
    if (typeof context.runId !== "string") throw new Error()
    validateRunId(context.runId)
    if (!Number.isSafeInteger(context.startCronRunId) ||
      (context.startCronRunId as number) < 0 ||
      typeof context.generationSha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(context.generationSha256)) throw new Error()
  } catch {
    throw new ProviderSchemaError("context", EMPTY_PROVIDER_OBSERVED_SHAPE)
  }
  const decoded = decodeCliQueryEnvelope(
    output, GUARD_BOOTSTRAP_MARKER, GUARD_BOOTSTRAP_RESULT_KEYS,
  )
  if (decoded.sample === null || typeof decoded.sample !== "object" ||
    Array.isArray(decoded.sample)) {
    throw new ProviderSchemaError("sample_shape", decoded.observed)
  }
  const row = decoded.sample as Record<string, unknown>
  if (Object.keys(row).sort().join(",") !== [...GUARD_BOOTSTRAP_RESULT_KEYS].sort().join(",")) {
    throw new ProviderSchemaError("sample_keys", decoded.observed)
  }
  if (!Number.isSafeInteger(row.guardJobId) || (row.guardJobId as number) < 0 ||
    typeof row.guardName !== "string" || typeof row.guardSchedule !== "string" ||
    typeof row.guardActive !== "boolean" || typeof row.runId !== "string" ||
    typeof row.generationSha256 !== "string" || typeof row.expiryUtc !== "string" ||
    typeof row.commandSha256 !== "string" || typeof row.commandMd5 !== "string") {
    throw new ProviderSchemaError("field_type", decoded.observed)
  }
  if ((row.guardJobId as number) < 1 || row.guardName !== EXPECTED_GUARD_NAME ||
    row.guardSchedule !== EXPECTED_GUARD_SCHEDULE || row.guardActive !== true ||
    row.runId !== context.runId || row.generationSha256 !== context.generationSha256) {
    throw new ProviderSchemaError("identity", decoded.observed)
  }
  const expiryPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/
  const expiryUtc = row.expiryUtc as string
  const millisecondExpiry = expiryUtc.replace(/(\.\d{3})\d{3}Z$/, "$1Z")
  if (!expiryPattern.test(expiryUtc) || Number.isNaN(Date.parse(expiryUtc)) ||
    new Date(expiryUtc).toISOString() !== millisecondExpiry) {
    throw new ProviderSchemaError("expiry", decoded.observed)
  }
  const template = generateDeadmanCommand({
    runId: context.runId, generationSha256: context.generationSha256,
    startCronRunId: context.startCronRunId,
    guardName: EXPECTED_GUARD_NAME, guardSchedule: EXPECTED_GUARD_SCHEDULE,
    targetJobs: EXPECTED_TARGET_JOBS, advisoryLockKey: DEADMAN_ADVISORY_LOCK_KEY,
    expiryPlaceholder: DEADMAN_EXPIRY_PLACEHOLDER,
  })
  const command = template.replace(DEADMAN_EXPIRY_PLACEHOLDER, expiryUtc)
  if (!/^[a-f0-9]{64}$/.test(row.commandSha256 as string) ||
    !/^[a-f0-9]{32}$/.test(row.commandMd5 as string) ||
    row.commandSha256 !== sha256Text(command) || row.commandMd5 !== md5Text(command)) {
    throw new ProviderSchemaError("command_hash", decoded.observed)
  }
  return row as unknown as GuardBootstrapResult
}
