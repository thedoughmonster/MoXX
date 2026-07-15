import type { JsonObject, JsonValue } from "./json_types.ts";

export type AcquisitionInput = {
  job_id: string;
  capability_token: string;
};

export type ClaimedJob = {
  job_id: string;
  operation_key: string;
  source_key: string;
  restaurant_guid: string;
  mode: string;
  window_start: string | null;
  window_end: string | null;
  cursor: JsonObject;
  parameters: JsonObject;
  coverage_policy_version: string;
  pagination_generation: number;
  correlation_id: string;
  capability_token: string;
};

export type OperationParameter = {
  parameter_key: string;
  parameter_location: "path" | "query";
  data_type: "string" | "integer" | "boolean" | "timestamp" | "date";
  required: boolean;
  validation_pattern: string | null;
};

export type RegisteredOperation = {
  operation_key: string;
  source_operation_id: string;
  http_method: string;
  path_template: string;
  resource_type: string;
  response_kind: "document" | "collection" | "status";
  pagination_kind: "none" | "page" | "cursor";
  page_size: number | null;
  requires_window: boolean;
  exact_resource_only: boolean;
  schema_version: number;
  api_base_url: string;
  client_id_secret_name: string;
  client_secret_secret_name: string;
  user_access_type: string;
  request_timeout_ms: number;
  first_business_date: string | null;
  operation_parameters: OperationParameter[];
};

export type WindowResolution = {
  parameters: Record<string, JsonValue>;
  cursor_context: JsonObject;
  next_cursor: JsonObject | null;
  coverage_start: string | null;
  coverage_end: string | null;
};

export type ResolvedParameters = {
  path: Record<string, string>;
  query: Record<string, string>;
  request_cursor: JsonObject;
  window: WindowResolution;
};

export type RegisteredRequest = {
  url: string;
  headers: Record<string, string>;
  request_cursor: JsonObject;
  window: WindowResolution;
};
