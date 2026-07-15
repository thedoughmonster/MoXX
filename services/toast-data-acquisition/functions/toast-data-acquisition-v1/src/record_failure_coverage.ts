import { sql } from "./database.ts";
import type { ClaimedJob, RegisteredRequest } from "./registry_types.ts";

export async function recordFailureCoverage(
  job: ClaimedJob,
  request: RegisteredRequest | undefined,
  disposition: "retry_wait" | "dead_letter",
  error: string,
): Promise<void> {
  const cursorContext = request
    ? { ...request.window.cursor_context }
    : { ...job.cursor };
  delete cursorContext.page;
  delete cursorContext.pageToken;
  const windowStart = request?.window.coverage_start ?? job.window_start;
  const windowEnd = request?.window.coverage_end ?? job.window_end;
  await sql`
    with counts as (
      select
        count(distinct attempt.attempt_id) filter (
          where attempt.http_status between 200 and 299
            and attempt.error_code is null
        )::integer as page_count,
        count(observation.observation_id)::bigint as record_count
      from toast_raw.api_request_attempts as attempt
      left join toast_raw.resource_observations as observation
        on observation.attempt_id = attempt.attempt_id
      where attempt.job_id = ${job.job_id}::bigint
        and attempt.request_cursor @> ${sql.json(cursorContext)}::jsonb
    )
    insert into toast_acquisition.coverage_windows (
      operation_key, restaurant_guid, window_start, window_end,
      coverage_status, page_count, record_count, notes
    )
    select ${job.operation_key}, ${job.restaurant_guid},
      ${windowStart}::timestamptz, ${windowEnd}::timestamptz,
      case when ${disposition} = 'dead_letter' then 'dead_letter'
        when counts.page_count > 0 or counts.record_count > 0 then 'partial'
        else 'gap' end,
      counts.page_count, counts.record_count, ${error}
    from counts
  `;
}
