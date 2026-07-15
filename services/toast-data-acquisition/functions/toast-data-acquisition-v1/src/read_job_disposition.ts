import { sql } from "./database.ts";

export async function readJobDisposition(
  jobId: string,
  capabilityToken: string,
): Promise<"already_succeeded" | "unavailable"> {
  const rows = await sql<{ status: string }[]>`
    select status
    from toast_acquisition.jobs
    where job_id = ${jobId}::bigint
      and capability_token = ${capabilityToken}::uuid
  `;
  return rows[0]?.status === "succeeded" ? "already_succeeded" : "unavailable";
}
