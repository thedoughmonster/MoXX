import type { JSONValue } from "postgres"

export function responsesTools(tools: JSONValue[]): JSONValue[] {
  return tools.map((tool) => {
    if (!tool || typeof tool !== "object" || Array.isArray(tool) || tool instanceof Date) {
      throw new Error("invalid_provider_tool")
    }
    const outer = tool as Record<string, JSONValue>
    const definition = outer.function
    if (outer.type !== "function" || !definition || typeof definition !== "object" ||
      Array.isArray(definition) || definition instanceof Date) {
      throw new Error("invalid_provider_tool")
    }
    return { type: "function", ...(definition as Record<string, JSONValue>) }
  })
}
