import { isJsonRecord } from "./is_json_record.ts"
import type {
  EvidenceEnvelope,
  JsonRecord,
  TrelloWebhookPayload,
} from "./types.ts"

const referenceFields = [
  ["board", "action_board_id"],
  ["card", "card_id"],
  ["list", "list_id"],
  ["checklist", "checklist_id"],
  ["checkItem", "check_item_id"],
  ["member", "member_id"],
] as const

export function buildEvidenceEnvelope(
  payload: TrelloWebhookPayload,
  rawBody: string,
  clientIdentifier: string | null,
): EvidenceEnvelope {
  const actorSnapshot = isJsonRecord(payload.action.memberCreator)
    ? payload.action.memberCreator
    : {}
  const actorId = payload.action.idMemberCreator
    ?? (typeof actorSnapshot.id === "string" ? actorSnapshot.id : "trello-system")
  const references: JsonRecord = {
    action_id: payload.action.id,
    board_id: payload.model.id,
    webhook_id: payload.webhook.id,
  }
  const actionData = isJsonRecord(payload.action.data) ? payload.action.data : {}
  for (const [sourceField, targetField] of referenceFields) {
    const reference = actionData[sourceField]
    if (isJsonRecord(reference) && typeof reference.id === "string") {
      references[targetField] = reference.id
    }
  }
  return {
    actionId: payload.action.id,
    actorId,
    boardId: payload.model.id,
    occurredAt: payload.action.date,
    payload,
    rawBody,
    sourceMetadata: {
      action_type: payload.action.type,
      actor_snapshot: actorSnapshot,
      external_references: references,
      client_identifier: clientIdentifier,
    },
  }
}
