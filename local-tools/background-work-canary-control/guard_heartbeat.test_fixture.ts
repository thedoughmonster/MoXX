import { DEV_PROJECT_REF } from "./constants.ts"
import {
  DEADMAN_ADVISORY_LOCK_KEY,
  DEADMAN_EXPIRY_PLACEHOLDER,
} from "./deadman_command_constants.ts"
import { VALID_DEADMAN_INPUT } from "./deadman_command.test_fixture.ts"
import { generateDeadmanCommand } from "./generate_deadman_command.ts"
import { md5Text } from "./md5_text.ts"
import {
  EXPECTED_GUARD_NAME,
  EXPECTED_GUARD_SCHEDULE,
  EXPECTED_TARGET_JOBS,
} from "./sample_constants.ts"
import { sha256Text } from "./sha256_text.ts"

export const NEXT_GENERATION_SHA256 = "d".repeat(64)
const HEARTBEAT_EXPIRY_UTC = "2026-08-02T02:04:05.654321Z"

export const VALID_GUARD_HEARTBEAT_INPUT = {
  projectRef: DEV_PROJECT_REF,
  runId: VALID_DEADMAN_INPUT.runId,
  guardJobId: 12,
  guardName: EXPECTED_GUARD_NAME,
  guardSchedule: EXPECTED_GUARD_SCHEDULE,
  targetJobs: EXPECTED_TARGET_JOBS,
  advisoryLockKey: DEADMAN_ADVISORY_LOCK_KEY,
  currentGenerationSha256: VALID_DEADMAN_INPUT.generationSha256,
  nextGenerationSha256: NEXT_GENERATION_SHA256,
  startCronRunId: VALID_DEADMAN_INPUT.startCronRunId,
  nextDeadmanCommand: generateDeadmanCommand({
    ...VALID_DEADMAN_INPUT,
    generationSha256: NEXT_GENERATION_SHA256,
    expiryPlaceholder: DEADMAN_EXPIRY_PLACEHOLDER,
  }),
} as const

const HEARTBEAT_COMMAND = VALID_GUARD_HEARTBEAT_INPUT.nextDeadmanCommand.replace(
  DEADMAN_EXPIRY_PLACEHOLDER, HEARTBEAT_EXPIRY_UTC,
)

export const VALID_GUARD_HEARTBEAT_RESULT = {
  guardJobId: 12,
  guardName: EXPECTED_GUARD_NAME,
  guardSchedule: EXPECTED_GUARD_SCHEDULE,
  guardActive: true,
  runId: VALID_DEADMAN_INPUT.runId,
  previousGenerationSha256: VALID_DEADMAN_INPUT.generationSha256,
  nextGenerationSha256: NEXT_GENERATION_SHA256,
  expiryUtc: HEARTBEAT_EXPIRY_UTC,
  commandSha256: sha256Text(HEARTBEAT_COMMAND),
  commandMd5: md5Text(HEARTBEAT_COMMAND),
} as const
