import type { JsonObject } from "./json_types.ts";
import type {
  RegisteredOperation,
  RegisteredRequest,
} from "./registry_types.ts";

export function resolveTokenConflictRestart(
  operation: RegisteredOperation,
  request: RegisteredRequest,
  status: number,
): JsonObject | null {
  if (
    status !== 409 || operation.pagination_kind !== "cursor" ||
    typeof request.request_cursor.pageToken !== "string"
  ) return null;
  const cursor = { ...request.window.cursor_context };
  delete cursor.pageToken;
  delete cursor.page;
  return cursor;
}
