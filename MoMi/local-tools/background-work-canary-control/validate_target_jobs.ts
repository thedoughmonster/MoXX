import { EXPECTED_TARGET_JOBS } from "./sample_constants.ts"
import type { TargetJobState } from "./sample_types.ts"
import { validateNonnegativeInteger } from "./validate_nonnegative_integer.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"

export function validateTargetJobs(value: unknown): readonly TargetJobState[] {
  if (!Array.isArray(value) || value.length !== EXPECTED_TARGET_JOBS.length) {
    throw new Error("Target job schema is invalid")
  }
  const jobs: TargetJobState[] = []
  for (const [index, expected] of EXPECTED_TARGET_JOBS.entries()) {
    const record = validateStrictRecord(value[index], [
      "jobId", "jobName", "schedule", "commandMd5", "active",
    ], "Target job")
    const jobId = validateNonnegativeInteger(record.jobId, "Target job ID")
    if (jobId !== expected.jobId || record.jobName !== expected.jobName ||
      record.schedule !== expected.schedule || record.commandMd5 !== expected.commandMd5 ||
      typeof record.active !== "boolean") {
      throw new Error("Target job identity, schedule, or digest drifted")
    }
    jobs.push({ ...expected, active: record.active })
  }
  return jobs
}
