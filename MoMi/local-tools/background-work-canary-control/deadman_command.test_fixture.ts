import {
  DEADMAN_ADVISORY_LOCK_KEY,
  DEADMAN_EXPIRY_PLACEHOLDER,
} from "./deadman_command_constants.ts"
import { EXPECTED_GUARD_NAME, EXPECTED_GUARD_SCHEDULE,
  EXPECTED_TARGET_JOBS } from "./sample_constants.ts"

export const VALID_DEADMAN_INPUT = {
  runId: "run-20260802-abcdef",
  generationSha256: "a".repeat(64),
  startCronRunId: 1_000,
  guardName: EXPECTED_GUARD_NAME,
  guardSchedule: EXPECTED_GUARD_SCHEDULE,
  targetJobs: EXPECTED_TARGET_JOBS,
  advisoryLockKey: DEADMAN_ADVISORY_LOCK_KEY,
  expiryPlaceholder: DEADMAN_EXPIRY_PLACEHOLDER,
} as const
