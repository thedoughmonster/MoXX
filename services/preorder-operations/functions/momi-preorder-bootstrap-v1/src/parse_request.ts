import type { BootstrapInput } from "./types.ts"

const keyPattern = /^[a-z][a-z0-9_-]{1,63}$/
const datePattern = /^\d{4}-\d{2}-\d{2}$/

export function parseRequest(url: URL): BootstrapInput | null {
  const keys = [...url.searchParams.keys()]
  if (keys.some((key) => !["surface_key", "fulfillment_date"].includes(key)) ||
    new Set(keys).size !== keys.length) return null
  const surfaceKey = url.searchParams.get("surface_key")
  const date = url.searchParams.get("fulfillment_date")
  if (!surfaceKey || !keyPattern.test(surfaceKey)) return null
  const timestamp = date === null ? null : Date.parse(`${date}T00:00:00Z`)
  if (date !== null && (!datePattern.test(date) || timestamp === null ||
    Number.isNaN(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== date)) return null
  return { surface_key: surfaceKey, fulfillment_date: date }
}
