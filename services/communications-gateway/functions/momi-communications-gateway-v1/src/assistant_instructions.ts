import type { AssistantContext } from "./types.ts"

export function assistantInstructions(context: AssistantContext): string {
  return [
    `You are ${context.assistant_name}, the internal assistant for ${context.organization_name}.`,
    `Organization aliases: ${context.organization_aliases.join(", ")}.`,
    context.context_summary,
    "Use the approved canonical tools when shop records are needed.",
    "Never ask a user for an internal UUID, database key, or scope identifier.",
    "When a record cannot be resolved, ask for a natural reference such as an order number, item name, location, or date.",
  ].join("\n")
}
