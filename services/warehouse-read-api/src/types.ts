export const contractVersion = 1

export type EntityReadContract = {
  functionKey: string
  entityType: "payment" | "menu_entity" | "employee" | "schedule"
  storedEntityTypes?: readonly string[]
  viewName: "payments_by_id_v1" | "menu_entities_by_id_v1" |
    "employees_by_id_v1" | "schedules_by_id_v1"
}

export type StockReadContract = {
  functionKey: "momi.stock_observations.get_latest.v1"
  viewName: "stock_observations_latest_v1"
}

export type EntityReadInput = {
  work_id: string
  entity_id: string
  capability_token: string
}

export type StockReadInput = {
  work_id: string
  item_id: string
  location_id: string
  capability_token: string
}

export type EntityReadRow = {
  work_id: string | null
  contract_active: boolean
  entity_id: string | null
  entity_type: string | null
  schema_version: number | null
  canonical_document: Record<string, unknown> | null
  provenance: Record<string, unknown> | null
  freshness: Record<string, unknown> | null
}

export type StockReadRow = {
  work_id: string | null
  contract_active: boolean
  item_id: string | null
  location_id: string | null
  observed_at: Date | string | null
  stock_state: string | null
  quantity: string | null
  provenance: Record<string, unknown> | null
  freshness: Record<string, unknown> | null
}
