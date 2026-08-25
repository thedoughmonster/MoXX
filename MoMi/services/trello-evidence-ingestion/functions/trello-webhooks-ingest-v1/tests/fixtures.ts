import { createHmac } from "node:crypto"

export const callbackUrl = "https://example.test/functions/v1/trello-webhooks-ingest-v1"
export const fixtureSecret = "fixture-only-not-a-credential"
export const actionId = "trello-action-1"
export const actorId = "trello-member-1"
export const boardId = "trello-board-1"
export const cardId = "trello-card-1"
export const listId = "trello-list-1"

export const webhookBody = JSON.stringify({
  action: {
    id: actionId,
    idMemberCreator: actorId,
    type: "updateCard",
    date: "2026-07-28T12:34:56.789Z",
    memberCreator: {
      id: actorId,
      fullName: "Kitchen Staff",
      username: "kitchen-staff",
    },
    data: {
      board: { id: boardId, name: "Kitchen Operations" },
      card: { id: cardId, name: "Turn off burners and broiler" },
      list: { id: listId, name: "Done" },
      sourceField: { preserved: true },
    },
  },
  model: { id: boardId, name: "Kitchen Operations", closed: false },
  webhook: { id: "trello-webhook-1", idModel: boardId, active: true },
  sourceField: { preserved: true },
})

export function signTrelloBody(
  body: string,
  secret = fixtureSecret,
  callback = callbackUrl,
): string {
  return createHmac("sha1", secret).update(body + callback).digest("base64")
}
