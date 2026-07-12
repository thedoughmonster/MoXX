export const functionKey = "momi.orders.get_by_guid.v1"
export const contractVersion = 1
export const registeredSchemaName = "momi_api"
export const registeredViewName = "toast_orders_by_guid_v1"

export type OrderReadInput = {
  work_id: string
  order_guid: string
  trigger_token: string
}

export type OrderRecord = {
  order_guid: string
  restaurant_guid: string
  order_version_id: string
  retrieved_at: string
  content_hash: string
  payload: Record<string, unknown>
}

export type OrderReadRow = {
  work_id: string | null
  work_order_version_id: string | null
  contract_active: boolean
  order_guid: string | null
  restaurant_guid: string | null
  order_version_id: string | null
  retrieved_at: string | null
  content_hash: string | null
  payload: Record<string, unknown> | null
}

export type OrderLookup =
  | { disposition: "forbidden" }
  | { disposition: "contract_inactive"; work_order_version_id: string }
  | { disposition: "order_not_found"; work_order_version_id: string }
  | {
    disposition: "found"
    work_order_version_id: string
    order: OrderRecord
  }

export type OrderReader = (input: OrderReadInput) => Promise<OrderLookup>

export type ExecutionResult = {
  status: number
  body: Record<string, unknown>
}
