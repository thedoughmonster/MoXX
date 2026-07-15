import { completeJob } from "./complete_job.ts";
import { completeJobAndClaimNext } from "./complete_job_and_claim_next.ts";
import { continueJob } from "./continue_job.ts";
import type { JsonObject } from "./json_types.ts";
import { recordFailureCoverage } from "./record_failure_coverage.ts";
import type { ClaimedJob, RegisteredRequest } from "./registry_types.ts";
import type { ExecutionResult } from "./runtime_types.ts";

export async function finalizePage(
  job: ClaimedJob,
  request: RegisteredRequest,
  nextCursor: JsonObject | null,
  attemptId: string,
  resourceCount: number,
  batchRuntimeSeconds: number | null,
  batchMaxJobs: number | null,
): Promise<ExecutionResult> {
  let disposition: "completed" | "continued" | "budget_exhausted" = "completed";
  let continuation;
  if (nextCursor) disposition = await continueJob(job, nextCursor);
  else if (batchRuntimeSeconds !== null && batchMaxJobs !== null) {
    const nextJob = await completeJobAndClaimNext(job);
    if (nextJob) {
      continuation = {
        job: nextJob,
        max_runtime_seconds: batchRuntimeSeconds,
        max_jobs: batchMaxJobs,
      };
    }
  } else await completeJob(job);
  if (disposition === "budget_exhausted") {
    await recordFailureCoverage(
      job,
      request,
      "dead_letter",
      "toast_pagination_budget_exhausted",
    );
    return {
      status: 502,
      body: {
        ok: false,
        disposition: "dead_letter",
        job_id: job.job_id,
        attempt_id: attemptId,
        resource_count: resourceCount,
        error: "source unavailable",
      },
    };
  }
  return {
    status: 200,
    body: {
      ok: true,
      disposition,
      job_id: job.job_id,
      attempt_id: attemptId,
      resource_count: resourceCount,
    },
    continuation,
  };
}
