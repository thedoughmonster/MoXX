import type { TickInput } from "./types.ts";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function parseTickInput(value: unknown): TickInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).some((key) =>
      key !== "tick_id" && key !== "capability_token"
    )
  ) return null;
  if (typeof record.tick_id !== "string" || !uuid.test(record.tick_id)) {
    return null;
  }
  if (
    typeof record.capability_token !== "string" ||
    !uuid.test(record.capability_token)
  ) return null;
  return {
    tick_id: record.tick_id.toLowerCase(),
    capability_token: record.capability_token.toLowerCase(),
  };
}
