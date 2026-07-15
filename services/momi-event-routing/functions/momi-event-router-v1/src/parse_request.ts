import type { RoutingInput } from "./types.ts"

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseRoutingInput(input: unknown): RoutingInput | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null
  }
  const value = input as Record<string, unknown>
  if (
    Object.keys(value).length !== 2 ||
    typeof value.event_id !== "string" ||
    typeof value.capability_token !== "string" ||
    !uuidPattern.test(value.event_id) ||
    !uuidPattern.test(value.capability_token)
  ) {
    return null
  }
  return {
    event_id: value.event_id,
    capability_token: value.capability_token,
  }
}
