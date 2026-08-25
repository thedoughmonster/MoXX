import type { JSONValue } from "postgres"
import { failedProviderResponse } from "./failed_provider_response.ts"
import type { InvocationReplay } from "./types.ts"
import { visibleAlias } from "./types.ts"

export function replayResponse(id: string, replay: InvocationReplay): {
  status: number
  body: Record<string, JSONValue>
} {
  if (["failed", "paid_ambiguous"].includes(replay.invocation_status)) {
    return failedProviderResponse(id, replay.invocation_status,
      replay.error_code ?? undefined)
  }
  if (["pending_archive", "admitted", "provider_started"].includes(
    replay.invocation_status,
  )) return { status: 409, body: { id, object: "momi.execution",
    model: visibleAlias, status: replay.invocation_status, replay: true,
    error: "request_in_progress" } }
  const body = replay.terminal_response
  const choices = body?.choices
  const choice = Array.isArray(choices) ? choices[0] : null
  const message = choice && typeof choice === "object" && !Array.isArray(choice)
    && "message" in choice
    ? choice.message : null
  const content = message && typeof message === "object" && !Array.isArray(message)
    && "content" in message
    ? message.content : null
  if (replay.invocation_status !== "completed" || body?.id !== id
    || body?.object !== "chat.completion" || body?.model !== visibleAlias
    || !Array.isArray(choices) || choices.length !== 1
    || typeof content !== "string" || content.trim().length === 0) {
    throw new Error("invocation_replay_invalid")
  }
  return { status: 200, body }
}
