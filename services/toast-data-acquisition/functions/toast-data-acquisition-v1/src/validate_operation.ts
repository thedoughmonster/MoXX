import type { RegisteredOperation } from "./registry_types.ts";

export function validateRegisteredOperation(
  operation: RegisteredOperation,
): URL {
  if (operation.http_method !== "GET") {
    throw new Error("Registered operation is not GET");
  }
  const base = new URL(operation.api_base_url);
  if (
    base.protocol !== "https:" || base.username || base.password ||
    base.search || base.hash
  ) {
    throw new Error("Registered source base URL is invalid");
  }
  const path = operation.path_template;
  if (
    !path.startsWith("/") || path.startsWith("//") ||
    path.includes("\\") || path.includes("?") || path.includes("#") ||
    path.split("/").some((part) => part === "." || part === "..")
  ) {
    throw new Error("Registered operation path is invalid");
  }
  const keys = new Set<string>();
  for (const parameter of operation.operation_parameters) {
    if (
      keys.has(parameter.parameter_key) ||
      !/^[A-Za-z][A-Za-z0-9]*$/.test(parameter.parameter_key)
    ) {
      throw new Error("Registered operation parameters are invalid");
    }
    keys.add(parameter.parameter_key);
  }
  const placeholders = [...path.matchAll(/\{([^{}]+)\}/g)].map((match) =>
    match[1]
  );
  const pathKeys = operation.operation_parameters
    .filter((parameter) => parameter.parameter_location === "path")
    .map((parameter) => parameter.parameter_key);
  if (
    placeholders.length !== new Set(placeholders).size ||
    placeholders.some((key) => !pathKeys.includes(key)) ||
    pathKeys.some((key) => !placeholders.includes(key))
  ) {
    throw new Error("Registered path parameters do not match its template");
  }
  const queryKeys = operation.operation_parameters
    .filter((parameter) => parameter.parameter_location === "query")
    .map((parameter) => parameter.parameter_key);
  if (
    operation.pagination_kind === "page" && !queryKeys.includes("page") ||
    operation.pagination_kind === "cursor" &&
      !queryKeys.includes("pageToken") ||
    operation.page_size !== null && !queryKeys.includes("pageSize")
  ) {
    throw new Error("Registered pagination parameters are incomplete");
  }
  return base;
}
