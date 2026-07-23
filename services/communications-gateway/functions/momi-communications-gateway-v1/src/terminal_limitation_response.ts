import { visibleAlias } from "./types.ts"

const messages: Record<string, string> = {
  provider_background_deadline_exceeded:
    "Maximum analysis did not finish within your configured deadline. It was not retried, so no additional paid attempt was made. Try a narrower request or ask an administrator to adjust the limit.",
  provider_background_id_missing:
    "Maximum analysis could not be tracked safely after it started. It was not retried, so no additional paid attempt was made. Please try a narrower request.",
  provider_background_poll_failed:
    "Maximum analysis status could not be retrieved safely. It was not retried, so no additional paid attempt was made. Please try a narrower request.",
  provider_round_not_authorized:
    "This analysis used the route's permitted answer rounds before it could finish. No additional provider attempt was made. Please try a narrower request.",
  tool_round_not_authorized:
    "This analysis used the route's permitted tool rounds before it could finish. No additional provider attempt was made. Please try a narrower request.",
}

export const terminalLimitationCodes = new Set(Object.keys(messages))

export function terminalLimitationResponse(id: string, code: string) {
  const content = messages[code]
  if (!content) throw new Error("terminal_limitation_code_invalid")
  return { status: 200, body: {
    id,
    object: "chat.completion",
    model: visibleAlias,
    choices: [{
      index: 0,
      message: { role: "assistant", content },
      finish_reason: "stop",
    }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  } }
}
