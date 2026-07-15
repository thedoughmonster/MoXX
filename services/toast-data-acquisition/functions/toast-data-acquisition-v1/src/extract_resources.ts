import type { JsonObject, JsonValue } from "./json_types.ts";
import type { RegisteredOperation } from "./registry_types.ts";

export function extractResponseResources(
  body: JsonValue,
  operation: RegisteredOperation,
  status: number,
): Array<JsonObject | JsonValue[]> {
  if (operation.response_kind === "collection") {
    const collection = Array.isArray(body)
      ? body
      : typeof body === "object" && body !== null &&
          !Array.isArray(body) && Array.isArray(body.data)
      ? body.data
      : null;
    if (!collection) throw new Error("Collection response is not an array");
    return collection.map((item) =>
      typeof item === "object" && item !== null
        ? item as JsonObject | JsonValue[]
        : { value: item }
    );
  }
  if (operation.response_kind === "document") {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new Error("Document response is not an object");
    }
    return [body];
  }
  if (typeof body === "object" && body !== null) {
    return [body as JsonObject | JsonValue[]];
  }
  return [{ http_status: status, value: body }];
}
