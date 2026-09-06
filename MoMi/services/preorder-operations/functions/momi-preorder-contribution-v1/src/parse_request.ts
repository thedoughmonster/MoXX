import type { Input } from "./types.ts"

const keyPattern = /^[a-z][a-z0-9_-]{1,63}$/
const datePattern = /^\d{4}-\d{2}-\d{2}$/

export async function parseRequest(request: Request): Promise<Input | null> {
  try {
    const value = await request.json() as Partial<Input>
    const timestamp = Date.parse(`${value.fulfillment_date}T00:00:00Z`)
    if (!value.surface_key || !keyPattern.test(value.surface_key) ||
      !value.fulfillment_date || !datePattern.test(value.fulfillment_date) ||
      Number.isNaN(timestamp) || !value.selection ||
      typeof value.selection !== "object") return null
    return value as Input
  } catch {
    return null
  }
}
