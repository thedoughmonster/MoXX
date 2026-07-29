// service-owner: trello-task-delivery

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export type FinalStatus = "succeeded" | "failed" | "ambiguous"
export type WorkRequest = { operationId: string; capabilityToken: string }
export type ClaimedOperation = WorkRequest & {
  operationType: "move_card"
  boardId: string
  cardId: string
  targetListId: string
}

export type DeliveryResult = {
  finalStatus: FinalStatus
  httpStatus: number | null
  headers: Record<string, string>
  payload: JsonValue | null
  rawText: string | null
  errorCode: string | null
}

export type Database = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Record<string, unknown>[]>
  json(value: unknown): unknown
}

export type DeliveryDependencies = {
  getSetting(name: string): string | undefined
  claim(work: WorkRequest): Promise<ClaimedOperation | null>
  deliver(operation: ClaimedOperation, key: string, token: string, marker: string): Promise<DeliveryResult>
  finish(operation: ClaimedOperation, result: DeliveryResult, marker: string): Promise<FinalStatus>
}
