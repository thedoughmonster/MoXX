import { sql } from "./database.ts";
import type { ClaimedJob, RegisteredRequest } from "./registry_types.ts";

export async function recordCoverage(
  job: ClaimedJob,
  request: RegisteredRequest,
  status: "complete" | "accepted_gap",
  notes: string | null,
): Promise<void> {
  await sql`
    with counts as (
      select
        (
          select count(*)::integer
          from toast_raw.api_request_attempts
          where job_id = ${job.job_id}::bigint
            and pagination_generation = ${job.pagination_generation}
            and http_status between 200 and 299 and error_code is null
            and request_cursor @>
              ${sql.json(request.window.cursor_context)}::jsonb
        ) as page_count,
        (
          select count(*)::bigint
          from toast_raw.resource_observations as observation
          join toast_raw.api_request_attempts as attempt
            on attempt.attempt_id = observation.attempt_id
          where attempt.job_id = ${job.job_id}::bigint
            and attempt.pagination_generation = ${job.pagination_generation}
            and attempt.error_code is null
            and attempt.request_cursor @>
              ${sql.json(request.window.cursor_context)}::jsonb
        ) as record_count,
        (
          select attempt_id
          from toast_raw.api_request_attempts
          where job_id = ${job.job_id}::bigint
            and pagination_generation = ${job.pagination_generation}
            and request_cursor @>
              ${sql.json(request.window.cursor_context)}::jsonb
          order by started_at desc, attempt_id desc limit 1
        ) as terminal_attempt_id
    )
    insert into toast_acquisition.coverage_windows (
      operation_key,
      restaurant_guid,
      window_start,
      window_end,
      coverage_status,
      page_count,
      record_count,
      notes,
      job_id,
      coverage_policy_version,
      coverage_dimensions,
      terminal_attempt_id,
      pagination_generation
    )
    select ${job.operation_key}, ${job.restaurant_guid},
      ${request.window.coverage_start}::timestamptz,
      ${request.window.coverage_end}::timestamptz,
      case when ${status} = 'complete' and counts.record_count = 0
        then 'empty' else ${status} end,
      counts.page_count, counts.record_count, ${notes},
      ${job.job_id}::bigint, ${job.coverage_policy_version},
      ${sql.json(job.parameters)}::jsonb, counts.terminal_attempt_id,
      ${job.pagination_generation}
    from counts
  `;
}
