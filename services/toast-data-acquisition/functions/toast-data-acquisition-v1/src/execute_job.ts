import { buildRegisteredRequest } from "./build_request.ts";
import { claimJob } from "./claim_job.ts";
import { executeAuthenticatedFetch } from "./execute_authenticated_fetch.ts";
import { getToastToken } from "./get_toast_token.ts";
import { invalidateToastToken } from "./invalidate_toast_token.ts";
import { loadRegisteredOperation } from "./load_registry.ts";
import { performArchivedRequest } from "./perform_archived_request.ts";
import { processAcquiredPage } from "./process_page.ts";
import { readJobDisposition } from "./read_job_disposition.ts";
import { readConfiguredSecret } from "./read_secret.ts";
import { recoverJob } from "./recover_job.ts";
import type { ExecutionResult, TokenConfig } from "./runtime_types.ts";

export async function executeJob(
  jobId: string,
  capabilityToken: string,
): Promise<ExecutionResult> {
  const job = await claimJob(jobId, capabilityToken);
  if (!job) {
    const disposition = await readJobDisposition(jobId, capabilityToken);
    return {
      status: disposition === "already_succeeded" ? 200 : 409,
      body: {
        ok: disposition === "already_succeeded",
        disposition,
        job_id: jobId,
      },
    };
  }
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
  return processAcquiredPage(job, operation, request, fetched.page);
}
