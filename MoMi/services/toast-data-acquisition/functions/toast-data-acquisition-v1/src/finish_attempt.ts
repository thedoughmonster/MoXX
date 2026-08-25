import { classifyHttpError } from "./classify_http_error.ts";
import { sql } from "./database.ts";
import { hashText } from "./hash_text.ts";
import type { SourcePage } from "./runtime_types.ts";

export async function finishApiAttempt(
  attemptId: string,
  page: SourcePage,
): Promise<void> {
  const responseHash = await hashText(page.raw_body);
  const errorCode = classifyHttpError(page.status);
  const responseJson = page.parsed_body.has_json
    ? sql.json(page.parsed_body.json)
    : null;
  await sql`
    update toast_raw.api_request_attempts
    set finished_at = now(),
        http_status = ${page.status},
        response_headers = ${sql.json(page.response_headers)},
        response_body = ${page.raw_body},
        response_json = ${responseJson},
        response_sha256 = ${responseHash},
        error_code = ${errorCode},
        error_message = ${errorCode ? "Toast request returned an error" : null}
    where attempt_id = ${attemptId}::uuid
  `;
}
