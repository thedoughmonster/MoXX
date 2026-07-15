import { buildRegisteredRequest } from "./build_request.ts";
import { executeAuthenticatedFetch } from "./execute_authenticated_fetch.ts";
import { getToastToken } from "./get_toast_token.ts";
import { invalidateToastToken } from "./invalidate_toast_token.ts";
import { loadRegisteredOperation } from "./load_registry.ts";
import { performArchivedRequest } from "./perform_archived_request.ts";
import { processAcquiredPage } from "./process_page.ts";
import { readConfiguredSecret } from "./read_secret.ts";
import { recoverJob } from "./recover_job.ts";
import type { ClaimedJob } from "./registry_types.ts";
import type {
  BatchBudget,
  BatchTiming,
  ExecutionResult,
  TokenConfig,
} from "./runtime_types.ts";

export async function executeClaimedJob(
  job: ClaimedJob,
  batchTiming: BatchTiming | null,
): Promise<ExecutionResult> {
  const operation = await loadRegisteredOperation(job);
  if (!operation) return recoverJob(job, "toast_registry_unavailable");
  let request;
  try {
    request = buildRegisteredRequest(job, operation);
  } catch {
    return recoverJob(job, "toast_invalid_registered_request");
  }
  const clientId = readConfiguredSecret(operation.client_id_secret_name);
  const clientSecret = readConfiguredSecret(
    operation.client_secret_secret_name,
  );
  if (!clientId || !clientSecret) {
    return recoverJob(job, "toast_credentials_unavailable", request);
  }
  const tokenConfig: TokenConfig = {
    api_base_url: operation.api_base_url,
    client_id: clientId,
    client_secret: clientSecret,
    user_access_type: operation.user_access_type,
    request_timeout_ms: operation.request_timeout_ms,
  };
  const fetched = await executeAuthenticatedFetch(tokenConfig, {
    get_token: getToastToken,
    invalidate_token: invalidateToastToken,
    perform: (tokenType, accessToken) =>
      performArchivedRequest(job, operation, request, tokenType, accessToken),
  });
  if (fetched.kind === "auth_error") {
    const errorCode = fetched.status === 429
      ? "toast_rate_limited"
      : fetched.status !== null && fetched.status >= 500
      ? "toast_authentication_server_error"
      : "toast_authentication_failed";
    return recoverJob(job, errorCode, request);
  }
  if (fetched.kind === "network_error") {
    return recoverJob(job, "toast_network_error", request);
  }
  const batchRuntimeSeconds = batchTiming && operation.worker_batch_enabled
    ? operation.worker_max_runtime_seconds
    : null;
  const batchMaxJobs = batchTiming && operation.worker_batch_enabled
    ? operation.worker_max_jobs
    : null;
  const batchBudget: BatchBudget | null = batchTiming &&
      batchRuntimeSeconds !== null && batchMaxJobs !== null
    ? {
      started_at_ms: batchTiming.started_at_ms,
      deadline_ms: batchTiming.deadline_ms ??
        batchTiming.started_at_ms + batchRuntimeSeconds * 1000,
      max_jobs: batchMaxJobs,
      request_timeout_ms: operation.request_timeout_ms,
      completed_jobs: batchTiming.completed_jobs,
    }
    : null;
  return processAcquiredPage(
    job,
    operation,
    request,
    fetched.page,
    batchBudget,
  );
}
