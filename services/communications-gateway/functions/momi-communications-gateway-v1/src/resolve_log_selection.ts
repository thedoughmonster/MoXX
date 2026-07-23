import { structuredSelection } from "./structured_log_selection.ts"
import type { ChatInput, LogSelection } from "./types.ts"

export function resolveLogSelection(input: ChatInput): LogSelection | null {
  if (input.momi_log) return structuredSelection(input, input.momi_log)
  return null
}
