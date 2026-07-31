import type { OrderInput } from "./types.ts";
export function parseRequest(value: unknown): OrderInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const c = v.contact as Record<string, unknown> | null;
  const allowed = new Set([
    "command_id",
    "contact",
    "expected_quote_version",
    "hold_id",
    "quote_id",
  ]);
  const contactAllowed = new Set(["email", "name", "phone"]);
  if (Object.keys(v).some((key) => !allowed.has(key))) return null;
  if (!uuid.test(String(v.command_id)) || !uuid.test(String(v.quote_id)) ||
    (v.hold_id !== undefined && !uuid.test(String(v.hold_id))) ||
    !Number.isInteger(v.expected_quote_version) || Number(v.expected_quote_version) < 1 ||
    !c || typeof c !== "object" || Array.isArray(c) || typeof c.name !== "string" ||
    c.name.trim().length < 1 || c.name.length > 120 ||
    Object.keys(c).some((key) => !contactAllowed.has(key)) ||
    (typeof c.email !== "string" && typeof c.phone !== "string") ||
    (c.email !== undefined && typeof c.email !== "string") ||
    (c.phone !== undefined && typeof c.phone !== "string") ||
    (typeof c.email === "string" && (c.email.length > 254 || !c.email.includes("@"))) ||
    (typeof c.phone === "string" && (c.phone.length < 7 || c.phone.length > 32))) return null;
  return v as OrderInput;
}
