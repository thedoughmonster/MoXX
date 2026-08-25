import { visibleAlias } from "./types.ts"

export const pendingAssistantContent =
  "MoMi is still working on this. This answer will update automatically."

export function pendingResponse(id: string) {
  return { status: 200, body: { id, object: "chat.completion", model: visibleAlias,
    choices: [{ index: 0, message: { role: "assistant", content: pendingAssistantContent },
      finish_reason: "stop" }], usage: { prompt_tokens: 0, completion_tokens: 0,
        total_tokens: 0 }, momi_background: true } }
}
