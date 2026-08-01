import { functionKey } from "./types.ts"

export function envelope(requestId: string, body: Record<string, unknown>) {
  return {
    meta: {
      contract_key: functionKey,
      request_id: requestId,
      generated_at: new Date().toISOString(),
    },
    ...body,
  }
}
