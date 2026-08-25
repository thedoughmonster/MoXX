import { beginApiAttempt } from "./begin_attempt.ts";
import { failApiAttemptNetwork } from "./fail_attempt_network.ts";
import { fetchSourcePage } from "./fetch_source_page.ts";
import { finishApiAttempt } from "./finish_attempt.ts";
import type {
  ClaimedJob,
  RegisteredOperation,
  RegisteredRequest,
} from "./registry_types.ts";
import type { ArchivedFetch, SourcePage } from "./runtime_types.ts";

export async function performArchivedRequest(
  job: ClaimedJob,
  operation: RegisteredOperation,
  request: RegisteredRequest,
  tokenType: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ArchivedFetch> {
  const attempt = await beginApiAttempt(job, request);
  let page: SourcePage;
  try {
    page = await fetchSourcePage(
      request,
      operation.request_timeout_ms,
      tokenType,
      accessToken,
      fetchImpl,
    );
  } catch {
    await failApiAttemptNetwork(attempt.attempt_id);
    return {
      kind: "network_error",
      attempt_id: attempt.attempt_id,
      error: "Toast request failed",
    };
  }
  await finishApiAttempt(attempt.attempt_id, page);
  return {
    kind: "response",
    page: { ...page, attempt_id: attempt.attempt_id },
  };
}
