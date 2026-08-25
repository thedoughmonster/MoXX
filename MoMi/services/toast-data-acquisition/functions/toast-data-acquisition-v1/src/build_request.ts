import { interpolateRegisteredPath } from "./interpolate_path.ts";
import type {
  ClaimedJob,
  RegisteredOperation,
  RegisteredRequest,
} from "./registry_types.ts";
import { resolveRegisteredParameters } from "./resolve_parameters.ts";
import { validateRegisteredOperation } from "./validate_operation.ts";

export function buildRegisteredRequest(
  job: ClaimedJob,
  operation: RegisteredOperation,
  now?: string,
): RegisteredRequest {
  const url = validateRegisteredOperation(operation);
  const resolved = resolveRegisteredParameters(job, operation, now);
  const path = interpolateRegisteredPath(
    operation.path_template,
    resolved.path,
  );
  const basePath = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
  url.pathname = `${basePath}${path}`;
  url.search = "";
  for (const parameter of operation.operation_parameters) {
    const value = resolved.query[parameter.parameter_key];
    if (parameter.parameter_location === "query" && value !== undefined) {
      url.searchParams.append(parameter.parameter_key, value);
    }
  }
  return {
    url: url.toString(),
    headers: {
      accept: "application/json",
      "toast-restaurant-external-id": job.restaurant_guid,
    },
    request_cursor: resolved.request_cursor,
    window: resolved.window,
  };
}
