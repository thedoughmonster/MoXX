import { sql } from "./database.ts";
import type { JsonObject } from "./json_types.ts";
import type { ClaimedJob } from "./registry_types.ts";

export async function restartTokenCursorJob(
  job: ClaimedJob,
  cursor: JsonObject,
): Promise<void> {
  const rows = await sql<{ next_token: string }[]>`
    select toast_acquisition.restart_token_cursor_job(
      ${job.job_id}::bigint,
      ${job.capability_token}::uuid,
      ${sql.json(cursor)}::jsonb
    )::text as next_token
  `;
  if (!rows[0]?.next_token) {
    throw new Error("Token cursor job was not restarted");
  }
}
