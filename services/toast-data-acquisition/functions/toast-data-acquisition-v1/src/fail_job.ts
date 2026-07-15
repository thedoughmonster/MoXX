import { sql } from "./database.ts";
import type { ClaimedJob } from "./registry_types.ts";

export async function failJob(
  job: ClaimedJob,
  error: string,
): Promise<"retry_wait" | "dead_letter"> {
  const rows = await sql<
    { disposition: "retry_wait" | "dead_letter" | "not_found" }[]
  >`
    select toast_acquisition.fail_job(
      ${job.job_id}::bigint,
      ${job.capability_token}::uuid,
      ${error}
    ) as disposition
  `;
  const disposition = rows[0]?.disposition;
  if (disposition !== "retry_wait" && disposition !== "dead_letter") {
    throw new Error("Acquisition job failure was not recorded");
  }
  return disposition;
}
