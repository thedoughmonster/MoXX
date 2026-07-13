export const functionKey = "momi.toast_orders.get_by_id.v1"
export const contractVersion = 1
export const registeredSchemaName = "momi_api"
export const registeredViewName = "toast_orders_by_id_v1"
export const sourceSystem = "toast"

export type OrderReadInput = {
  work_id: string
  order_id: string
  trigger_token: string
}

export type OrderRecord = {
  source_system: string
  source_version_id: string
  order_id: string
  location_id: string
  retrieved_at: string
  content_hash: string
  payload: Record<string, unknown>
}

export type OrderReadRow = {
  work_id: string | null
  work_source_version_id: string | null
  contract_active: boolean
  source_system: string | null
  source_version_id: string | null
  order_id: string | null
  location_id: string | null
  retrieved_at: string | null
  content_hash: string | null
  payload: Record<string, unknown> | null
}

export type OrderLookup =
  | { disposition: "forbidden" }
  | { disposition: "contract_inactive"; work_source_version_id: string }
  | { disposition: "order_not_found"; work_source_version_id: string }
  | {
    disposition: "found"
    work_source_version_id: string
    order: OrderRecord
  }

export type OrderReader = (input: OrderReadInput) => Promise<OrderLookup>

export type ExecutionResult = {
  status: number
  body: Record<string, unknown>
}
