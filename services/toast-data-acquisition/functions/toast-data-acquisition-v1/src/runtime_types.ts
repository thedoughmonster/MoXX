import type { JsonObject, JsonValue } from "./json_types.ts";
import type { ClaimedJob, RegisteredRequest } from "./registry_types.ts";

export type TokenConfig = {
  api_base_url: string;
  client_id: string;
  client_secret: string;
  user_access_type: string;
  request_timeout_ms: number;
};

export type TokenResult =
  | { ok: true; token_type: string; access_token: string }
  | { ok: false; status: number | null; error: string };

export type ParsedBody = {
  has_json: boolean;
  json: JsonValue;
};

export type SourcePage = {
  status: number;
  raw_body: string;
  parsed_body: ParsedBody;
  response_headers: Record<string, string>;
  retrieved_at: string;
};

export type AttemptHandle = {
  attempt_id: string;
  started_at: string;
};

export type ArchivedPage = SourcePage & { attempt_id: string };

export type ArchivedFetch =
  | { kind: "response"; page: ArchivedPage }
  | { kind: "network_error"; attempt_id: string; error: string };

export type AuthenticatedFetch =
  | { kind: "response"; page: ArchivedPage }
  | { kind: "network_error"; attempt_id: string; error: string }
  | { kind: "auth_error"; status: number | null; error: string };

export type AuthRetryDependencies = {
  get_token: (
    config: TokenConfig,
    fetch_impl?: typeof fetch,
  ) => Promise<TokenResult>;
  invalidate_token: () => void;
  perform: (token_type: string, access_token: string) => Promise<ArchivedFetch>;
};

export type ResourceRecord = {
  source_id: string;
  source_version_id: string;
  source_updated_at: string | null;
  content_hash: string;
  payload: JsonObject | JsonValue[];
};

export type ExecutionResult = {
  status: number;
  body: Record<string, unknown>;
  continuation?: BatchContinuation;
};

export type BatchContinuation = {
  job: ClaimedJob;
  max_runtime_seconds: number;
  max_jobs: number;
};

export type SuccessContext = {
  job: ClaimedJob;
  request: RegisteredRequest;
  page: ArchivedPage;
};
