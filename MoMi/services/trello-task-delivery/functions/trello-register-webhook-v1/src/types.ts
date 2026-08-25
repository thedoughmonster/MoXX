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
  operationType: "register_webhook"
  boardId: string
  callbackUrl: string
  description: string
  inventoryJobId: string
  inventoryCompletedAt: string
  callbackHeadEvidenceRef: string
  callbackHeadVerifiedAt: string
  callbackHeadHttpStatus: 200
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
