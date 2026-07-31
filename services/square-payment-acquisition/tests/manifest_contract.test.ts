import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("declares a read-only Sandbox acquisition boundary without runtime activation", async () => {
  const directory = new URL("../", import.meta.url)
  const manifest = JSON.parse(await readFile(new URL("service.json", directory), "utf8"))
  const contract = JSON.parse(await readFile(
    new URL("contracts/square-payment-observation-v1.schema.json", directory), "utf8",
  ))
  const result = JSON.parse(await readFile(
    new URL("contracts/square-payment-observation-result-v1.schema.json", directory), "utf8",
  ))
  const webhook = JSON.parse(await readFile(
    new URL("contracts/square-webhook-event-v1.schema.json", directory), "utf8",
  ))

  assert.equal(manifest.service_type, "procurement_adapter")
  assert.deepEqual(manifest.network.outbound_hosts, ["connect.squareupsandbox.com"])
  assert.deepEqual(manifest.functions, [])
  assert.equal(contract.$id, "momi://square.payment.retrieve.v1/input")
  assert.equal(result.$id, "momi://square.payment.retrieve.v1/output")
  assert.equal(webhook.$id, "momi://square.payment.webhook.authenticate.v1/output")
  assert.equal("source_token" in contract.properties, false)
})
