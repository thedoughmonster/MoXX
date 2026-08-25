import type { Message } from "./types.ts"

export function routingContext(messages: Message[]): string {
  const selected = messages.filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-4).map((message) => `${message.role}: ${message.content.slice(0, 3000)}`)
  return selected.join("\n").slice(-8000)
}
