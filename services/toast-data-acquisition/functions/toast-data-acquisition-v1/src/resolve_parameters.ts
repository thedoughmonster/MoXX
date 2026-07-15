import { formatRegisteredParameter } from "./format_parameter.ts";
import type { JsonObject, JsonValue } from "./json_types.ts";
import type {
  ClaimedJob,
  RegisteredOperation,
  ResolvedParameters,
} from "./registry_types.ts";
import { resolveWindow } from "./resolve_window.ts";

export function resolveRegisteredParameters(
  job: ClaimedJob,
  operation: RegisteredOperation,
  now?: string,
): ResolvedParameters {
  const registered = new Set(
    operation.operation_parameters.map((item) => item.parameter_key),
  );
  const controls = new Set(["date_selector", "window_policy"]);
  if (
    Object.keys(job.parameters).some((key) =>
      !registered.has(key) && !controls.has(key)
    )
  ) {
    throw new Error("Job contains an unregistered operation parameter");
  }
  if (job.cursor.page !== undefined && operation.pagination_kind !== "page") {
    throw new Error("Page cursor is not registered for this operation");
  }
  if (
    job.cursor.pageToken !== undefined && operation.pagination_kind !== "cursor"
  ) {
    throw new Error("Token cursor is not registered for this operation");
  }
  const window = resolveWindow(job, operation, now);
  const values: Record<string, JsonValue> = {
    ...job.parameters,
    ...window.parameters,
  };
  const requestCursor: JsonObject = { ...window.cursor_context };
  if (operation.pagination_kind === "page") {
    const page = job.cursor.page ?? values.page ?? 1;
    if (typeof page !== "number" || !Number.isSafeInteger(page) || page < 1) {
      throw new Error("Page cursor is invalid");
    }
    values.page = page;
    requestCursor.page = page;
    if (values.pageSize === undefined && operation.page_size !== null) {
      values.pageSize = operation.page_size;
    }
  }
  if (
    operation.pagination_kind === "cursor" && job.cursor.pageToken !== undefined
  ) {
    if (
      typeof job.cursor.pageToken !== "string" ||
      job.cursor.pageToken.length > 16384
    ) {
      throw new Error("Token cursor is invalid");
    }
    values.pageToken = job.cursor.pageToken;
    requestCursor.pageToken = job.cursor.pageToken;
  }
  const path: Record<string, string> = {};
  const query: Record<string, string> = {};
  for (const parameter of operation.operation_parameters) {
    let value = values[parameter.parameter_key];
    if (
      value === undefined && parameter.parameter_location === "path" &&
      parameter.parameter_key === "restaurantGUID"
    ) {
      value = job.restaurant_guid;
    }
    if (value === undefined) {
      if (parameter.required) {
        throw new Error(
          `Required parameter ${parameter.parameter_key} is missing`,
        );
      }
      continue;
    }
    const formatted = formatRegisteredParameter(parameter, value);
    if (parameter.parameter_location === "path") {
      path[parameter.parameter_key] = formatted;
    } else {
      query[parameter.parameter_key] = formatted;
    }
  }
  return { path, query, request_cursor: requestCursor, window };
}
