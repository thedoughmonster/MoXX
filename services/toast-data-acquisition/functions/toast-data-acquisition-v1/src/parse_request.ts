import type { AcquisitionInput } from "./registry_types.ts";

const maxJobId = 9223372036854775807n;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseAcquisitionInput(input: unknown): AcquisitionInput | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null;
  }
  const value = input as Record<string, unknown>;
  const token = value.capability_token;
  if (
    Object.keys(value).length !== 2 || !("job_id" in value) ||
    typeof token !== "string" || !uuidPattern.test(token)
  ) {
    return null;
  }
  const jobId = value.job_id;
  if (typeof jobId === "number") {
    return Number.isSafeInteger(jobId) && jobId > 0
      ? { job_id: String(jobId), capability_token: token }
      : null;
  }
  if (typeof jobId !== "string" || !/^[1-9][0-9]*$/.test(jobId)) {
    return null;
  }
  return BigInt(jobId) <= maxJobId
    ? { job_id: jobId, capability_token: token }
    : null;
}
