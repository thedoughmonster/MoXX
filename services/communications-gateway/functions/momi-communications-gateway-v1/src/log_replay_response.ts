import type { JSONValue } from "postgres"
import type { InvocationReplay } from "./types.ts"

export function logReplayResponse(id: string, replay: InvocationReplay): {
  status: number
  body: Record<string, JSONValue>
} {
  if (replay.invocation_status === "failed") return { status: 503, body: {
    id, object: "momi.log", model: "momi-assistant", status: "failed",
    error: replay.error_code ?? "request_failed",
  } }
  if (["pending_archive", "admitted"].includes(replay.invocation_status)) {
    return { status: 409, body: {
      id, object: "momi.log", model: "momi-assistant",
      status: replay.invocation_status, error: "request_in_progress",
    } }
  }
  const body = replay.terminal_response
  if (replay.invocation_status !== "completed" || replay.provider_calls !== 0
    || body?.id !== id || body?.object !== "momi.log"
    || body?.model !== "momi-assistant" || body?.status !== "completed"
    || !["stored", "duplicate"].includes(String(body?.disposition))
    || typeof body?.selection_id !== "string"
    || typeof body?.shop_log_id !== "string") {
    throw new Error("log_replay_invalid")
  }
  return { status: 200, body }
}
