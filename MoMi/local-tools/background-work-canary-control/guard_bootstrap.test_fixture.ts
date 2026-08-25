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

const BOOTSTRAP_EXPIRY_UTC = "2026-08-02T02:03:04.123456Z"

export const VALID_GUARD_BOOTSTRAP_INPUT = {
  projectRef: DEV_PROJECT_REF,
  runId: VALID_DEADMAN_INPUT.runId,
  generationSha256: VALID_DEADMAN_INPUT.generationSha256,
  startCronRunId: VALID_DEADMAN_INPUT.startCronRunId,
  guardName: EXPECTED_GUARD_NAME,
  guardSchedule: EXPECTED_GUARD_SCHEDULE,
  targetJobs: EXPECTED_TARGET_JOBS,
  advisoryLockKey: DEADMAN_ADVISORY_LOCK_KEY,
  deadmanCommand: generateDeadmanCommand(VALID_DEADMAN_INPUT),
} as const

const BOOTSTRAP_COMMAND = VALID_GUARD_BOOTSTRAP_INPUT.deadmanCommand.replace(
  DEADMAN_EXPIRY_PLACEHOLDER, BOOTSTRAP_EXPIRY_UTC,
)

export const VALID_GUARD_BOOTSTRAP_RESULT = {
  guardJobId: 12,
  guardName: EXPECTED_GUARD_NAME,
  guardSchedule: EXPECTED_GUARD_SCHEDULE,
  guardActive: true,
  runId: VALID_DEADMAN_INPUT.runId,
  generationSha256: VALID_DEADMAN_INPUT.generationSha256,
  expiryUtc: BOOTSTRAP_EXPIRY_UTC,
  commandSha256: sha256Text(BOOTSTRAP_COMMAND),
  commandMd5: md5Text(BOOTSTRAP_COMMAND),
} as const
