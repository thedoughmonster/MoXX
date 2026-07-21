import { visibleAlias } from "./types.ts"

export function failedProviderResponse(id: string, status: string) {
  return { status: 502, body: { id, object: "momi.execution", model: visibleAlias, status } }
}
