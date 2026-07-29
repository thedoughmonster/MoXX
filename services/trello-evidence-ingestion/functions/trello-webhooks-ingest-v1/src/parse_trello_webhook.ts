import { isJsonRecord } from "./is_json_record.ts"
import type { TrelloWebhookPayload } from "./types.ts"

export function parseTrelloWebhook(rawBody: string): TrelloWebhookPayload | null {
  try {
    const parsed: unknown = JSON.parse(rawBody)
    if (!isJsonRecord(parsed)) return null
    const action = parsed.action
    const model = parsed.model
    const webhook = parsed.webhook
    if (!isJsonRecord(action) || !isJsonRecord(model) || !isJsonRecord(webhook)) {
      return null
    }
    if (
      typeof action.id !== "string" || action.id.length === 0
      || typeof action.type !== "string" || action.type.length === 0
      || typeof action.date !== "string"
      || Number.isNaN(Date.parse(action.date))
      || typeof model.id !== "string" || model.id.length === 0
      || typeof webhook.id !== "string" || webhook.id.length === 0
    ) return null
    if (action.data !== undefined && !isJsonRecord(action.data)) return null
    if (
      action.memberCreator !== undefined
      && !isJsonRecord(action.memberCreator)
    ) return null
    const actionActor = action.idMemberCreator
    const snapshotActor = isJsonRecord(action.memberCreator)
      ? action.memberCreator.id
      : undefined
    if (
      actionActor !== undefined
        && (typeof actionActor !== "string" || actionActor.length === 0)
      || snapshotActor !== undefined
        && (typeof snapshotActor !== "string" || snapshotActor.length === 0)
      || actionActor && snapshotActor && actionActor !== snapshotActor
      || webhook.idModel !== undefined
        && (typeof webhook.idModel !== "string" || webhook.idModel !== model.id)
    ) return null
    return parsed as TrelloWebhookPayload
  } catch {
    return null
  }
}
