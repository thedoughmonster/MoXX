import type { JsonObject } from "./json_types.ts";
import { parseLinkNextPage } from "./parse_link_page.ts";
import type {
  RegisteredOperation,
  RegisteredRequest,
} from "./registry_types.ts";

export function resolveNextCursor(
  operation: RegisteredOperation,
  request: RegisteredRequest,
  responseHeaders: Record<string, string>,
): JsonObject | null {
  if (operation.pagination_kind === "cursor") {
    const token = responseHeaders["toast-next-page-token"]?.trim();
    if (token) {
      if (token.length > 16384) {
        throw new Error("Toast page token is too large");
      }
      if (token === request.request_cursor.pageToken) {
        throw new Error("Toast pagination repeated page token");
      }
      return { ...request.window.cursor_context, pageToken: token };
    }
  }
  if (operation.pagination_kind === "page") {
    const link = responseHeaders.link;
    const page = link ? parseLinkNextPage(link, request.url) : null;
    if (page !== null) return { ...request.window.cursor_context, page };
  }
  return request.window.next_cursor;
}
