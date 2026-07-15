import { executeClaimedJob } from "./execute_claimed_job.ts";
import type { ClaimedJob } from "./registry_types.ts";
import type { BatchContinuation } from "./runtime_types.ts";

export async function runBackgroundBatch(
  continuation: BatchContinuation,
): Promise<void> {
  const startedAt = Date.now();
  let current: ClaimedJob | null = continuation.job;
  let processedJobs = continuation.completed_jobs;
  try {
    while (current) {
      const batchTiming = {
        started_at_ms: continuation.started_at_ms,
        deadline_ms: continuation.deadline_ms,
        completed_jobs: processedJobs,
      };
      const result = await executeClaimedJob(current, batchTiming);
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
