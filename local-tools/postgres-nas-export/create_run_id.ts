import { randomUUID } from "node:crypto"

export function createRunId(now = new Date()): string {
  const timestamp = now.toISOString().replace(/[-:.]/g, "")
  return `${timestamp}-${randomUUID().replaceAll("-", "").slice(0, 12)}`
}
