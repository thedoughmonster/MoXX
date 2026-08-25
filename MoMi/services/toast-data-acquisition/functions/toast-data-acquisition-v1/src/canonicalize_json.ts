import type { JsonValue } from "./json_types.ts";

export function canonicalizeJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(",")}]`;
  }
  const fields = Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalizeJson(value[key])}`
  );
  return `{${fields.join(",")}}`;
}
