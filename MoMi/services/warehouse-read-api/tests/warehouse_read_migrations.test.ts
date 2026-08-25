import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import test from "node:test"

const capabilityUrl = new URL(
  "../../../supabase/migrations/20260714185856_create_warehouse_read_capabilities.sql",
  import.meta.url,
)
const consumptionUrl = new URL(
  "../../../supabase/migrations/20260715064305_consume_order_read_capabilities.sql",
  import.meta.url,
)
const registrationUrl = new URL(
  "../../../supabase/migrations/20260714190933_register_warehouse_read_routes_v2.sql",
  import.meta.url,
)
const slugs = [
  "momi-warehouse-payments-get-by-id-v1",
  "momi-warehouse-menu-entities-get-by-id-v1",
  "momi-warehouse-employees-get-by-id-v1",
  "momi-warehouse-schedules-get-by-id-v1",
  "momi-warehouse-stock-observations-get-by-id-v1",
]

test("read capabilities are private, scoped, and expiring", async () => {
  const [source, consumption] = await Promise.all([
    readFile(capabilityUrl, "utf8"), readFile(consumptionUrl, "utf8"),
  ])
  assert.match(source, /^-- service-owner: warehouse-read-api/m)
  assert.match(source, /subject_entity_id uuid not null/)
  assert.match(source, /scope_entity_id uuid/)
  assert.match(source, /capability_token uuid not null/)
  assert.match(source, /expires_at timestamptz not null/)
  assert.match(source, /binding_key text not null/)
  assert.match(source, /consumed_at timestamptz/)
  assert.match(source, /order_read_capabilities_are_bound/)
  assert.match(source, /enable row level security/)
  assert.match(source, /from public, anon, authenticated/)
  assert.match(consumption, /consume_read_capability/)
  assert.match(consumption, /queue_message_id = binding\.queue_message_id/)
})

test("registrations match every manifest hash and route", async () => {
  const source = await readFile(registrationUrl, "utf8")
  for (const slug of slugs) {
    const manifest = await readFile(new URL(
      `../functions/${slug}/function.json`, import.meta.url), "utf8")
    const parsed = JSON.parse(manifest) as { function_key: string }
    const hash = createHash("sha256").update(manifest).digest("hex")
    assert.match(source, new RegExp(parsed.function_key.replaceAll(".", "\\.")))
    assert.match(source, new RegExp(`/functions/v1/${slug}`))
    assert.match(source, new RegExp(hash))
  }
  assert.match(source, /durable\.read_capability\.v1/g)
  assert.doesNotMatch(source, /durable\.work_token\.v1/)
})
