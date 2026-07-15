import { canContinueBatch } from "./can_continue_batch.ts";
import { executeClaimedJob } from "./execute_claimed_job.ts";
import type { ClaimedJob } from "./registry_types.ts";
import type { BatchContinuation } from "./runtime_types.ts";

export async function runBackgroundBatch(
  continuation: BatchContinuation,
): Promise<void> {
  const startedAt = Date.now();
  const deadline = startedAt + continuation.max_runtime_seconds * 1000;
  let current: ClaimedJob | null = continuation.job;
  let processedJobs = 0;
  try {
    while (current) {
      const allowHandoff = processedJobs + 1 < continuation.max_jobs &&
        canContinueBatch(deadline, Date.now());
      const result = await executeClaimedJob(current, allowHandoff);
      processedJobs += 1;
      current = result.continuation?.job ?? null;
    }
    console.info("Toast acquisition background batch finished", {
      processed_jobs: processedJobs,
      elapsed_ms: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("Toast acquisition background batch stopped", {
      job_id: current?.job_id ?? null,
      processed_jobs: processedJobs,
      elapsed_ms: Date.now() - startedAt,
      error_name: error instanceof Error ? error.name : "UnknownError",
    });
  }
}
