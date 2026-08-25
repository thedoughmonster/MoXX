import type { JsonValue } from "./json_types.ts";
import type { ParsedBody } from "./runtime_types.ts";

export function parseResponseBody(rawBody: string): ParsedBody {
  if (rawBody.length === 0) return { has_json: false, json: null };
  try {
    return { has_json: true, json: JSON.parse(rawBody) as JsonValue };
  } catch {
    return { has_json: false, json: null };
  }
}
