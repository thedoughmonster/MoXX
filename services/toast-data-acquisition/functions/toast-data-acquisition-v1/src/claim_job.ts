import { sql } from "./database.ts";
import type { ClaimedJob } from "./registry_types.ts";

export async function claimJob(
  jobId: string,
  capabilityToken: string,
): Promise<ClaimedJob | null> {
  const rows = await sql<ClaimedJob[]>`
    select
      claimed.job_id::text,
      claimed.operation_key,
      claimed.source_key,
      claimed.restaurant_guid,
      claimed.mode,
      claimed.window_start::text,
      claimed.window_end::text,
      claimed.cursor,
      claimed.parameters,
      claimed.coverage_policy_version,
      claimed.pagination_generation,
      claimed.correlation_id::text,
      claimed.capability_token::text
    from toast_acquisition.claim_job(
      ${jobId}::bigint,
      ${capabilityToken}::uuid
    ) as claimed
  `;
  return rows[0] ?? null;
}
