import type { JSONValue } from "postgres"
import type { Admission } from "./types.ts"

export function replayResponse(admission: Admission): {
  status: number
  body: Record<string, JSONValue>
} {
  const terminal = ["completed", "failed", "paid_ambiguous"].includes(
    admission.invocation_status,
  )
  return {
    status: terminal ? 200 : 202,
    body: {
      id: admission.invocation_id,
      object: "momi.execution",
      model: "momi-assistant",
      status: admission.invocation_status,
      replay: true,
      error: admission.error_code ? "request_failed" : null,
    },
  }
}
