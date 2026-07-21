import type { ChatInput } from "./types.ts"

export function hasLogIntent(input: ChatInput): boolean {
  if (input.momi_log) return true
  const latest = [...input.messages].reverse().find((message) => message.role === "user")
  return Boolean(latest && /\b(log this|save this to (the )?momi log)\b/iu.test(latest.content))
}
