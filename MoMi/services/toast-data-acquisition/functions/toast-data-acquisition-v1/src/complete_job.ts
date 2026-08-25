import { sql } from "./database.ts";
import type { ClaimedJob } from "./registry_types.ts";

export async function completeJob(job: ClaimedJob): Promise<void> {
  const rows = await sql<{ completed: boolean }[]>`
    select toast_acquisition.complete_job(
      ${job.job_id}::bigint,
      ${job.capability_token}::uuid
    ) as completed
  `;
  if (rows[0]?.completed !== true) {
    throw new Error("Acquisition job was not completed");
  }
}
