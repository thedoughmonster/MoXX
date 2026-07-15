import { sql } from "./database.ts";

export async function markAttemptInvalid(
  attemptId: string,
  message: string,
): Promise<void> {
  await sql`
    update toast_raw.api_request_attempts
    set error_code = 'toast_invalid_response',
        error_message = ${message}
    where attempt_id = ${attemptId}::uuid
  `;
}
