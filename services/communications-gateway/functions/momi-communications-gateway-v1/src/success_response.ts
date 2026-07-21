import type { JSONValue } from "postgres"
import { visibleAlias } from "./types.ts"

export function successResponse(body: Record<string, JSONValue>, id: string) {
  return { status: 200, body: { ...body, id, object: "chat.completion", model: visibleAlias } }
}
