import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

import type { ServiceManifest } from "../scripts/architecture/types.ts"

const workspaceRoot = new URL("../", import.meta.url).pathname
const servicesRoot = join(workspaceRoot, "services")
const contractKey = "momi.toast_orders.get_by_id.v1"
const entries = await readdir(servicesRoot, { withFileTypes: true })
const manifests = await Promise.all(entries.filter((entry) => entry.isDirectory())
  .map(async (entry) => JSON.parse(await readFile(join(
    servicesRoot, entry.name, "service.json",
  ), "utf8")) as ServiceManifest))
const reader = manifests.find((manifest) =>
  manifest.service_key === "toast-order-read-api")
const consumers = manifests.filter((manifest) => manifest.contracts.consumes
  .some((contract) => contract.contract === contractKey))
  .map((manifest) => manifest.service_key).sort()
const catalog = await readFile(join(workspaceRoot, "docs/service-catalog.md"), "utf8")
const readerReadme = await readFile(join(
  servicesRoot, "toast-order-read-api", "README.md",
), "utf8")
const alertingReadme = await readFile(join(
  servicesRoot, "order-alerting", "README.md",
), "utf8")
const hydrationReadme = await readFile(join(
  servicesRoot, "toast-order-hydration", "README.md",
), "utf8")
const contract = await readFile(join(
  workspaceRoot, "docs/contracts/momi-toast-order-api-v1.md",
), "utf8")
const activation = await readFile(join(
  workspaceRoot, "supabase/migrations/20260716144455_activate_source_neutral_order_alerts.sql",
), "utf8")
const webhookProducer = await readFile(join(
  workspaceRoot, "supabase/migrations/20260714090044_handoff_webhooks_to_order_alerts.sql",
), "utf8")
const hydrationProducer = await readFile(join(
  servicesRoot, "toast-order-hydration/functions/toast-orders-fetch-by-guid-v1/src/persist_order_response.ts",
), "utf8")

test("records the retiring implemented posture without claiming availability", () => {
  assert.equal(reader?.lifecycle_status, "retiring")
  assert.equal(reader?.implementation_status, "implemented")
  assert.match(reader?.purpose ?? "", /retiring/u)
  assert.match(catalog, new RegExp(
    "`toast-order-read-api` \\| retiring \\| implemented \\| not_asserted",
    "u",
  ))
})

test("allows exactly order-alerting as the legacy compatibility consumer", () => {
  assert.deepEqual(consumers, ["order-alerting"])
  assert.match(readerReadme, /only permitted current service consumer/u)
  assert.match(alertingReadme, /only permitted current[\s\S]*consumer/u)
  assert.match(contract, /only permitted current[\s\S]*service consumer/u)
  assert.match(contract, /No new service[\s\S]*consumer/u)
})

test("inventories and fences both legacy invocation-work producers", () => {
  assert.match(webhookProducer, /insert into momi_orders\.api_invocation_work/u)
  assert.match(webhookProducer, /where mapping\.is_enabled/u)
  assert.match(activation,
    /update toast_hydration\.webhook_order_mappings[\s\S]*set is_enabled = false[\s\S]*momi\.toast_orders\.get_by_id\.v1/u)
  assert.match(hydrationProducer, /insert into momi_orders\.api_invocation_work/u)
  assert.match(hydrationProducer, /job\.downstream_api_contract_key/u)
  assert.match(hydrationReadme, /separately approved, bounded/u)
  assert.match(hydrationReadme,
    /Automatic webhook, normal, bulk, speculative, and open-ended[\s\S]*prohibited/u)
})

test("keeps the path on drift until hydration and invocation work drain", () => {
  assert.match(hydrationReadme,
    /Every matching hydration job and attempt[\s\S]*terminal or[\s\S]*dispositioned/u)
  assert.match(contract,
    /pending, running, retry-wait, or unresolved[\s\S]*failed row/u)
  assert.match(contract, /unknown caller[\s\S]*preserves the existing path/u)
  assert.match(contract, /separate operational authority and rollback/u)
  assert.match(readerReadme, /Unhosting or[\s\S]*separate operational authority/u)
})
