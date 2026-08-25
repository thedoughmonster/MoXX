import { classifyHttpError } from "./classify_http_error.ts";
import { deriveResources } from "./derive_resources.ts";
import { enqueuePaymentDetails } from "./enqueue_payment_details.ts";
import { extractPaymentGuids } from "./extract_payment_guids.ts";
import { extractResponseResources } from "./extract_resources.ts";
import { finalizePage } from "./finalize_page.ts";
import { isAcceptedNoContent } from "./is_accepted_no_content.ts";
import { markAttemptInvalid } from "./mark_attempt_invalid.ts";
import { persistResourceObservations } from "./persist_resources.ts";
import { recordCoverage } from "./record_coverage.ts";
import { recoverJob } from "./recover_job.ts";
import type {
  ClaimedJob,
  RegisteredOperation,
  RegisteredRequest,
} from "./registry_types.ts";
import { resolveNextCursor } from "./resolve_next_cursor.ts";
import { resolveTokenConflictRestart } from "./resolve_token_conflict_restart.ts";
import { restartTokenCursorJob } from "./restart_token_cursor_job.ts";
import type {
  ArchivedPage,
  BatchBudget,
  ExecutionResult,
} from "./runtime_types.ts";

export async function processAcquiredPage(
  job: ClaimedJob,
  operation: RegisteredOperation,
  request: RegisteredRequest,
  page: ArchivedPage,
  batchBudget: BatchBudget | null,
): Promise<ExecutionResult> {
  if (isAcceptedNoContent(operation, page.status)) {
    await recordCoverage(
      job,
      request,
      "accepted_gap",
      "Toast kitchen coverage unavailable",
    );
    const nextCursor = request.window.next_cursor;
    return finalizePage(
      job,
      request,
      nextCursor,
      page.attempt_id,
      0,
      batchBudget,
    );
  }
  const restartCursor = resolveTokenConflictRestart(
    operation,
    request,
    page.status,
  );
  if (restartCursor) {
    await restartTokenCursorJob(job, restartCursor);
    return {
      status: 200,
      body: {
        ok: true,
        disposition: "continued",
        job_id: job.job_id,
        attempt_id: page.attempt_id,
        resource_count: 0,
      },
    };
  }
  const httpError = classifyHttpError(page.status);
  if (httpError) return recoverJob(job, httpError, request);
  if (!page.parsed_body.has_json && operation.response_kind !== "status") {
    await markAttemptInvalid(page.attempt_id, "Toast response was not JSON");
    return recoverJob(job, "toast_invalid_response", request);
  }
  let records;
  let nextCursor;
  let paymentGuids: string[];
  try {
    const payloads = extractResponseResources(
      page.parsed_body.json,
      operation,
      page.status,
    );
    paymentGuids = extractPaymentGuids(operation, payloads);
    records = await deriveResources(payloads, operation);
    nextCursor = resolveNextCursor(operation, request, page.response_headers);
  } catch {
    await markAttemptInvalid(
      page.attempt_id,
      "Toast response contract was invalid",
    );
    return recoverJob(job, "toast_invalid_response", request);
  }
  const resourceCount = await persistResourceObservations(
    job,
    operation,
    page.attempt_id,
    page.retrieved_at,
    request.request_cursor,
    records,
  );
  try {
    await enqueuePaymentDetails(job, paymentGuids);
  } catch {
    return recoverJob(job, "toast_payment_detail_enqueue_failed", request);
  }
  const paginationContinues = nextCursor !== null &&
    (nextCursor.page !== undefined || nextCursor.pageToken !== undefined);
  if (!paginationContinues) {
    await recordCoverage(job, request, "complete", null);
  }
  return finalizePage(
    job,
    request,
    nextCursor,
    page.attempt_id,
    resourceCount,
    batchBudget,
  );
}
