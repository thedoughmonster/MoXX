// service-owner: trello-data-acquisition

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export type WorkRequest = { jobId: string; capabilityToken: string }
export type ClaimedJob = WorkRequest & { boardId: string }

export type SourceResult = {
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

export type InventoryDependencies = {
  getSetting(name: string): string | undefined
  claim(work: WorkRequest): Promise<ClaimedJob | null>
  acquire(job: ClaimedJob, apiKey: string, apiToken: string): Promise<SourceResult>
  finish(job: ClaimedJob, result: SourceResult): Promise<"succeeded" | "failed">
}
