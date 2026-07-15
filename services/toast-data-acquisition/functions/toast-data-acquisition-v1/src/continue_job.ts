import { sql } from "./database.ts";
import type { JsonObject } from "./json_types.ts";
import type { ClaimedJob } from "./registry_types.ts";

export async function continueJob(
  job: ClaimedJob,
  cursor: JsonObject,
): Promise<"continued" | "budget_exhausted"> {
  const rows = await sql<{
    disposition: "continued" | "budget_exhausted";
    next_token: string | null;
  }[]>`
    select continuation.disposition, continuation.next_token::text
    from toast_acquisition.continue_job(
      ${job.job_id}::bigint,
      ${job.capability_token}::uuid,
      ${sql.json(cursor)}::jsonb
    ) as continuation
  `;
  const continuation = rows[0];
  if (continuation?.disposition === "budget_exhausted") {
    return "budget_exhausted";
  }
  if (continuation?.disposition !== "continued" || !continuation.next_token) {
    throw new Error("Acquisition job was not continued");
  }
  return "continued";
}
