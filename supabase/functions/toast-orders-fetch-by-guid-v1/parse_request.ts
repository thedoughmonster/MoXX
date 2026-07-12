const maxJobId = 9223372036854775807n

export function parseJobId(input: unknown): string | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null
  }

  const record = input as Record<string, unknown>
  if (Object.keys(record).length !== 1 || !("job_id" in record)) {
    return null
  }

  const jobId = record.job_id
  if (typeof jobId === "number") {
    return Number.isSafeInteger(jobId) && jobId > 0 ? String(jobId) : null
  }

  if (typeof jobId !== "string" || !/^[1-9][0-9]*$/.test(jobId)) {
    return null
  }

  return BigInt(jobId) <= maxJobId ? jobId : null
}
