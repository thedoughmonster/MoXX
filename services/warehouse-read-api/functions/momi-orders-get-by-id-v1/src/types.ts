export const functionKey = "momi.orders.get_by_id.v1"
export const contractVersion = 1

export type OrderReadInput = {
  work_id: string
  order_id: string
  capability_token: string
}

export type OrderReadRow = {
  work_id: string | null
  contract_active: boolean
  order_id: string | null
  schema_version: number | null
  order_document: Record<string, unknown> | null
  order_presentation: Record<string, unknown> | null
  provenance: Record<string, unknown> | null
  freshness: Record<string, unknown> | null
}
