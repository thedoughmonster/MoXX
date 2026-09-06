export const functionKey = "momi.preorder.contribution.revalidate.v1"

export type OwnerRef = Readonly<{
  owner_service: "preorder-operations"
  contract_key: string
  resource_id: string
  resource_version: number
}>

export type Selection = Readonly<{
  campaign_ref: OwnerRef
  menu_ref: OwnerRef
  event_ref: OwnerRef | null
  product_ref: OwnerRef
  option_refs: OwnerRef[]
  fulfillment_ref: OwnerRef
  fulfillment_evidence: Record<string, unknown>
  quantity: number
  eligibility_evidence: Record<string, unknown>
  pricing: Record<string, unknown>
  allergen_evidence: Record<string, unknown>
  rule_refs: OwnerRef[]
  disclosures: string[]
  valid_until: string
}>

export type Input = Readonly<{
  surface_key: string
  fulfillment_date: string
  selection: Selection
}>

export type BootstrapRead = Readonly<{
  admitted: boolean
  data: Record<string, unknown> | null
}>

export type Reader = (input: Input) => Promise<BootstrapRead>
