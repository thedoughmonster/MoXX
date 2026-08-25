import { failJob } from "./fail_job.ts";
import { recordFailureCoverage } from "./record_failure_coverage.ts";
import type { ClaimedJob, RegisteredRequest } from "./registry_types.ts";
import type { ExecutionResult } from "./runtime_types.ts";

export async function recoverJob(
  job: ClaimedJob,
  errorCode: string,
  request?: RegisteredRequest,
): Promise<ExecutionResult> {
  const disposition = await failJob(job, errorCode);
  await recordFailureCoverage(job, request, disposition, errorCode);
  return {
    status: errorCode === "toast_rate_limited" ? 503 : 502,
    body: {
      ok: false,
      disposition,
      job_id: job.job_id,
      error: "source unavailable",
    },
  };
}
