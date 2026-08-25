export const functionKey = "momi.orders.get_by_version.v1"
export const contractVersion = 1

export type OrderVersionReadInput = {
  work_id: string
  order_id: string
  order_version_id: string
  capability_token: string
}

export type OrderVersionReadRow = {
  work_id: string | null
  contract_active: boolean
  order_id: string | null
  order_version_id: string | null
  schema_version: number | null
  order_document: Record<string, unknown> | null
  order_presentation: Record<string, unknown> | null
  provenance: Record<string, unknown> | null
  freshness: Record<string, unknown> | null
}
