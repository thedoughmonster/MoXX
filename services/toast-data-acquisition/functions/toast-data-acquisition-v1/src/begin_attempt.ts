import { sql } from "./database.ts";
import type { ClaimedJob, RegisteredRequest } from "./registry_types.ts";
import type { AttemptHandle } from "./runtime_types.ts";
import { selectSafeHeaders } from "./select_safe_headers.ts";

export async function beginApiAttempt(
  job: ClaimedJob,
  request: RegisteredRequest,
): Promise<AttemptHandle> {
  const requestHeaders = selectSafeHeaders(new Headers(request.headers));
  const rows = await sql<AttemptHandle[]>`
    insert into toast_raw.api_request_attempts (
      job_id,
      operation_key,
      restaurant_guid,
      request_url,
      request_headers,
      request_cursor,
      pagination_generation,
      started_at,
      correlation_id
    ) values (
      ${job.job_id}::bigint,
      ${job.operation_key},
      ${job.restaurant_guid},
      ${request.url},
      ${sql.json(requestHeaders)},
      ${sql.json(request.request_cursor)},
      ${job.pagination_generation},
      now(),
      ${job.correlation_id}::uuid
    )
    returning attempt_id::text, started_at::text
  `;
  if (rows.length !== 1) throw new Error("API request attempt was not created");
  return rows[0];
}
