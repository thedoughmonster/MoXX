import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("declares a read-only Sandbox acquisition boundary without runtime activation", async () => {
  const directory = new URL("../", import.meta.url)
  const manifest = JSON.parse(await readFile(new URL("service.json", directory), "utf8"))
  const contract = JSON.parse(await readFile(
    new URL("contracts/public/square.payment.retrieve.v1/input.schema.json", directory), "utf8",
  ))
  const result = JSON.parse(await readFile(
    new URL("contracts/public/square.payment.retrieve.v1/output.schema.json", directory), "utf8",
  ))
  const webhook = JSON.parse(await readFile(
    new URL("contracts/public/square.payment.webhook.authenticate.v1/output.schema.json", directory), "utf8",
  ))

  assert.deepEqual([manifest.service_type, manifest.implementation_status, manifest.network.outbound_hosts], ["procurement_adapter", "implemented", ["connect.squareupsandbox.com"]])
  assert.deepEqual([manifest.functions, manifest.contracts.provides, manifest.deployment.owns], [[], ["square.payment.retrieve.v1", "square.payment.webhook.authenticate.v1"], []])
  assert.equal(contract.$id, "momi://square.payment.retrieve.v1/input")
  assert.equal(result.$id, "momi://square.payment.retrieve.v1/output")
  assert.equal(webhook.$id, "momi://square.payment.webhook.authenticate.v1/output")
  assert.equal("source_token" in contract.properties, false)
})
