import { ownerRef as ref } from "./owner_ref.ts"
import type { Input, Selection } from "./types.ts"

type Versions = Record<string, number>
type Item = Record<string, unknown>
type Window = Record<string, unknown>

export function buildContext(
  input: Input, data: Record<string, unknown>,
): Selection | null {
  const versions = data.versions as Versions | undefined
  const surfaceId = data.surface_id as string | undefined
  const catalog = data.catalog as Item[] | undefined
  const windows = data.fulfillment_windows as Window[] | undefined
  if (!versions || !surfaceId || !catalog || !windows) return null
  const item = catalog.find((candidate) =>
    candidate.item_id === input.selection.product_ref.resource_id)
  const window = windows.find((candidate) =>
    candidate.window_id === input.selection.fulfillment_ref.resource_id)
  if (!item || !window) return null
  const choices = (item.option_groups as Array<Record<string, unknown>> ?? [])
    .flatMap((group) => group.choices as Item[] ?? [])
  const selectedChoiceIds = new Set(input.selection.option_refs.map((choice) =>
    choice.resource_id))
  const selectedChoices = choices.filter((choice) =>
    selectedChoiceIds.has(choice.choice_id as string))
  if (selectedChoices.length !== selectedChoiceIds.size) return null
  const itemVersion = item.item_version as number
  const policyVersion = versions.policy_version
  return {
    campaign_ref: ref("momi.preorder.bootstrap.read.v1", surfaceId,
      versions.surface_version),
    menu_ref: ref("momi.preorder.bootstrap.read.v1", surfaceId,
      versions.catalog_version),
    event_ref: null,
    product_ref: ref("momi.preorder.bootstrap.read.v1",
      item.item_id as string, itemVersion),
    option_refs: selectedChoices.map((choice) => ref(
      "momi.preorder.bootstrap.read.v1", choice.choice_id as string,
      itemVersion)),
    fulfillment_ref: ref("momi.preorder.bootstrap.read.v1",
      window.window_id as string, policyVersion),
    fulfillment_evidence: { pickup_date: window.date,
      location_ref: ref("momi.preorder.bootstrap.read.v1",
        data.location_id as string, versions.mapping_version),
      availability: window.availability, cutoff_at: window.order_cutoff_at },
    quantity: input.selection.quantity,
    eligibility_evidence: { eligible: item.available,
      maximum_quantity: item.maximum_quantity },
    pricing: { unit_price: item.base_price,
      option_price_deltas: selectedChoices.map((choice) => choice.price_delta),
      deposit_rule: "full_payment_at_checkout", deposit: null },
    allergen_evidence: { status: item.allergen_status,
      declared_allergens: item.allergens },
    rule_refs: [
      ref("momi.preorder.contribution.revalidate.v1", surfaceId, policyVersion),
      ref("momi.preorder.bootstrap.read.v1", surfaceId,
        versions.mapping_version),
    ],
    disclosures: item.disclosures as string[] ?? [],
    valid_until: data.expires_at as string,
  }
}
