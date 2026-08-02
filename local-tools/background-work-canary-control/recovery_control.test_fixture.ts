import { DEV_PROJECT_REF } from "./constants.ts"
import { DEADMAN_ADVISORY_LOCK_KEY } from "./deadman_command_constants.ts"
import {
  EXPECTED_GUARD_NAME,
  EXPECTED_GUARD_SCHEDULE,
  EXPECTED_TARGET_JOBS,
} from "./sample_constants.ts"

export const VALID_RECOVERY_CONTROL_INPUT = {
  projectRef: DEV_PROJECT_REF,
  repository: {
    nodeVersion: "24.14.0",
    pnpmVersion: "11.7.0",
    supabaseCliVersion: "2.109.1",
    branch: "dev",
    headSha: "9e9425ac63cdfaf2fad0fb8a12b975642221aac9",
    projectRef: DEV_PROJECT_REF,
  },
  guardJobId: 12,
  guardName: EXPECTED_GUARD_NAME,
  guardSchedule: EXPECTED_GUARD_SCHEDULE,
  targetJobs: EXPECTED_TARGET_JOBS,
  advisoryLockKey: DEADMAN_ADVISORY_LOCK_KEY,
} as const

export const INACTIVE_TARGETS = EXPECTED_TARGET_JOBS.map((job) => ({
  ...job,
  active: false,
}))

export const VALID_ROLLBACK_ABSENT_RESULT = {
  targetJobs: INACTIVE_TARGETS,
  guardIdentityCount: 0,
  guardPresent: false,
  guardJobId: 0,
  guard: {
    jobName: EXPECTED_GUARD_NAME,
    schedule: EXPECTED_GUARD_SCHEDULE,
    active: false,
  },
  guardState: "guard_absent",
} as const

export const VALID_ROLLBACK_INACTIVE_RESULT = {
  ...VALID_ROLLBACK_ABSENT_RESULT,
  guardIdentityCount: 1,
  guardPresent: true,
  guardJobId: 12,
  guardState: "guard_inactive",
} as const

export const VALID_CLEANUP_RESULT = {
  targetJobs: INACTIVE_TARGETS,
  guardIdentityCount: 0,
  guardPresent: false,
  guardJobId: 0,
  guardState: "guard_absent",
} as const

export function encodeRecoveryResult(marker: string, sample: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify([{
    marker, schema_version: 1, sample,
  }])}\n`)
}
