// service-owner: trello-evidence-ingestion

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export type JsonRecord = { [key: string]: JsonValue }

export type TrelloAction = JsonRecord & {
  id: string
  type: string
  date: string
  idMemberCreator?: string
  memberCreator?: JsonRecord & { id?: string }
  data?: JsonRecord
}

export type TrelloWebhookPayload = JsonRecord & {
  action: TrelloAction
  model: JsonRecord & { id: string }
  webhook: JsonRecord & { id: string; idModel?: string }
}

export type EvidenceEnvelope = {
  actionId: string
  actorId: string
  boardId: string
  occurredAt: string
  payload: TrelloWebhookPayload
  rawBody: string
  sourceMetadata: JsonRecord
}

export type StoreDisposition = "stored" | "duplicate"

export type StoreReceipt = {
  disposition: StoreDisposition
  archiveItemId: string
  contentHash: string
}

export type Database = {
  (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<Record<string, unknown>[]>
  json(value: unknown): unknown
}

export type IngestionDependencies = {
  getSetting(name: string): string | undefined
  store(envelope: EvidenceEnvelope): Promise<StoreReceipt>
}
