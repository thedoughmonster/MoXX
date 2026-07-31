import type { HoldInput } from "./types.ts";
export function parseRequest(value: unknown): HoldInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const allowed = new Set([
    "action",
    "command_id",
    "expected_quote_version",
    "hold_id",
    "quote_id",
  ]);
  if (Object.keys(v).some((key) => !allowed.has(key))) return null;
  if (!uuid.test(String(v.command_id)) || !uuid.test(String(v.quote_id)) ||
    !["create", "recover", "expire", "release"].includes(String(v.action)) ||
    !Number.isInteger(v.expected_quote_version) || Number(v.expected_quote_version) < 1) return null;
  if (v.action === "create" && v.hold_id !== undefined) return null;
  if (v.action !== "create" && !uuid.test(String(v.hold_id))) return null;
  return v as HoldInput;
}
