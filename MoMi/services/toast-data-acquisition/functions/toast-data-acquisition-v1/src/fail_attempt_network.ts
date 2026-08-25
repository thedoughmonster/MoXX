import { sql } from "./database.ts";

export async function failApiAttemptNetwork(attemptId: string): Promise<void> {
  await sql`
    update toast_raw.api_request_attempts
    set finished_at = now(),
        error_code = 'toast_network_error',
        error_message = 'Toast request failed before a response was received'
    where attempt_id = ${attemptId}::uuid
  `;
}
