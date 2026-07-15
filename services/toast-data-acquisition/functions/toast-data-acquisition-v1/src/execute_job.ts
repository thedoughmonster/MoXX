import { claimJob } from "./claim_job.ts";
import { executeClaimedJob } from "./execute_claimed_job.ts";
import { readJobDisposition } from "./read_job_disposition.ts";
import type { ExecutionResult } from "./runtime_types.ts";

export async function executeJob(
  jobId: string,
  capabilityToken: string,
): Promise<ExecutionResult> {
  const job = await claimJob(jobId, capabilityToken);
  if (!job) {
    const disposition = await readJobDisposition(jobId, capabilityToken);
    return {
      status: disposition === "already_succeeded" ? 200 : 409,
      body: {
        ok: disposition === "already_succeeded",
        disposition,
        job_id: jobId,
      },
    };
  }
  return executeClaimedJob(job, true);
}
