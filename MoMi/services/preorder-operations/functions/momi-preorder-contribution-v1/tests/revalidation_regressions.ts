import assert from "node:assert/strict"
import { revalidate } from "../src/revalidate.ts"
import type { Input, OwnerRef, Selection } from "../src/types.ts"

export function assertRevalidationRegressions(
  input: Input, data: Record<string, unknown>,
) {
  const current = revalidate(input, data).context as Selection
  const selections = [
    [{ ...current, fulfillment_ref: { ...current.fulfillment_ref,
      resource_version: current.fulfillment_ref.resource_version + 1 } }, "window"],
    [{ ...current, pricing: { ...current.pricing,
      option_price_deltas: [{ currency: "USD", amount_minor: 1 }] } }, "price"],
    [{ ...current, valid_until: "2100-01-01T00:00:00Z" }, "eligibility"],
  ]
  for (const [selection, field] of selections) {
    const result = revalidate({ ...input, selection }, data)
    assert.equal(result.outcome, "stale")
    assert.ok(result.corrections.some((issue) => issue.field === field))
  }
  const missing = structuredClone(data)
  missing.fulfillment_windows = []
  assert.equal(revalidate(input, missing).corrections[0].field, "window")
  missing.fulfillment_windows = data.fulfillment_windows
  missing.catalog = []
  assert.equal(revalidate(input, missing).corrections[0].field, "eligibility")
  const optionRef: OwnerRef = { ...input.selection.product_ref,
    resource_id: "10000000-0000-4000-8000-000000000099" }
  const option = { ...input, selection: { ...input.selection,
    option_refs: [optionRef] } }
  assert.equal(revalidate(option, data).corrections[0].field, "option")
}
