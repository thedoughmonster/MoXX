import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import Ajv from "ajv"

import { handleRequestWithReader } from "../src/handle_request_with_reader.ts"
import { revalidate } from "../src/revalidate.ts"
import type { Input, OwnerRef, Selection } from "../src/types.ts"

const fixture = JSON.parse(await readFile(new URL(
  "../../../fixtures/bootstrap-response.json", import.meta.url), "utf8")) as {
    data: Record<string, unknown>
  }
fixture.data.expires_at = "2099-01-01T00:00:00Z"
const id = (value: string, version = 1): OwnerRef => ({
  owner_service: "preorder-operations", contract_key:
    "momi.preorder.bootstrap.read.v1", resource_id: value,
  resource_version: version,
})
const input: Input = {
  surface_key: "preorder", fulfillment_date: "2026-08-01",
  selection: {
    campaign_ref: id("10000000-0000-4000-8000-000000000002"),
    menu_ref: id("10000000-0000-4000-8000-000000000002"), event_ref: null,
    product_ref: id("10000000-0000-4000-8000-000000000005"),
    option_refs: [],
    fulfillment_ref: id("10000000-0000-4000-8000-000000000004"),
    fulfillment_evidence: {}, quantity: 2, eligibility_evidence: {},
    pricing: {}, allergen_evidence: {}, rule_refs: [],
    disclosures: [], valid_until: "2099-01-01T00:00:00Z",
  },
}

test("publishes exact owner context and accepts only an exact restore", () => {
  const first = revalidate(input, fixture.data)
  assert.equal(first.outcome, "stale")
  const exact = { ...input, selection: first.context as Selection }
  assert.deepEqual(revalidate(exact, fixture.data), {
    outcome: "accepted", context: first.context, corrections: [],
  })
  assert.equal(exact.selection.pricing.deposit_rule,
    "full_payment_at_checkout")
  assert.equal(exact.selection.product_ref.resource_version, 1)
  assert.equal(exact.selection.rule_refs.length, 2)
})

test("reports every material changed field before acceptance", () => {
  const current = revalidate(input, fixture.data).context as Selection
  const stale = { ...current, quantity: 3, pricing: {},
    allergen_evidence: {}, disclosures: [], rule_refs: [] }
  const result = revalidate({ ...input, selection: stale }, fixture.data)
  assert.equal(result.outcome, "stale")
  assert.deepEqual(new Set(result.corrections.map((issue) => issue.field)),
    new Set(["price", "deposit", "allergen", "eligibility", "disclosures"]))
  assert.ok(result.corrections.every((issue) =>
    issue.announcement && issue.focus_target && issue.next_action))
})

test("fails closed for missing policy, sold out capacity, and quantity", () => {
  assert.equal(revalidate(input, null).corrections[0].code,
    "missing_configuration")
  const changed = structuredClone(fixture.data) as Record<string, unknown>
  const windows = changed.fulfillment_windows as Array<Record<string, unknown>>
  const catalog = changed.catalog as Array<Record<string, unknown>>
  windows[0].availability = "sold_out"
  catalog[0].maximum_quantity = 1
  const result = revalidate(input, changed)
  assert.equal(result.outcome, "rejected")
  assert.deepEqual(result.corrections.slice(0, 2).map((issue) => issue.code),
    ["sold_out", "quantity_changed"])
})

test("handler is bounded and returns no customer or payment material", async () => {
  const current = revalidate(input, fixture.data).context as Selection
  const request = new Request("https://example.test", { method: "POST",
    body: JSON.stringify({ ...input, selection: current }) })
  const response = await handleRequestWithReader(request,
    () => Promise.resolve({ admitted: true, data: fixture.data }))
  const body = await response.text()
  assert.equal(response.status, 200)
  assert.doesNotMatch(body, /customer|contact|source_token|payment_attempt/i)
  const api = JSON.parse(await readFile(new URL(
    "../../../contracts/preorder-public-v1.openapi.json", import.meta.url),
  "utf8"))
  const ajv = new Ajv({ strict: false, validateFormats: false })
  ajv.addSchema(api, "preorder")
  const validate = ajv.getSchema(
    "preorder#/components/schemas/ContributionRevalidationResponse")
  assert.ok(validate)
  assert.equal(validate(JSON.parse(body)), true, ajv.errorsText(validate.errors))
})

test("rejects malformed nested selection as an invalid request", async () => {
  const request = new Request("https://example.test", { method: "POST",
    body: JSON.stringify({ ...input, selection: { quantity: 1 } }) })
  const response = await handleRequestWithReader(request,
    () => Promise.resolve({ admitted: true, data: fixture.data }))
  assert.equal(response.status, 400)
  assert.equal((await response.json()).error.code, "invalid_request")
})

test("revalidates configured option group cardinality", () => {
  const changed = structuredClone(fixture.data) as Record<string, unknown>
  const catalog = changed.catalog as Array<Record<string, unknown>>
  catalog[0].option_groups = [{ minimum: 1, maximum: 1, choices: [] }]
  const result = revalidate(input, changed)
  assert.equal(result.outcome, "rejected")
  assert.ok(result.corrections.some((issue) => issue.code === "option_changed"))
})
