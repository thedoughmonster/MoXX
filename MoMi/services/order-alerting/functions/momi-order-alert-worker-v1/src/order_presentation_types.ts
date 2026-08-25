export type FulfillmentTiming = "scheduled" | "asap" | "unknown"

type OrderPresentationFields = {
  display_number: string
  customer_label?: string | null
  item_count: number
  total_amount: number | null
  items: Array<{
    name: string
    quantity: number
    modifiers: Array<{
      name: string
      quantity: number
      depth: number
    }>
  }>
}

export type TransitionalOrderPresentation = OrderPresentationFields & {
  presentation_version: 1
  fulfillment_timing?: FulfillmentTiming
  fulfillment_at: string | null
  fulfillment_epoch: number | null
}

export type ExactOrderPresentation = OrderPresentationFields & {
  presentation_version: 2
  fulfillment_timing: FulfillmentTiming
  fulfillment_at?: string | null
  fulfillment_epoch?: number | null
}

export type OrderPresentation =
  | TransitionalOrderPresentation
  | ExactOrderPresentation
