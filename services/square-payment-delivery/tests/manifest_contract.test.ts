import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("declares one Sandbox-only host-ready boundary without deployment", async () => {
  const directory = new URL("../", import.meta.url)
  const manifest = JSON.parse(await readFile(new URL("service.json", directory), "utf8"))
  const contract = JSON.parse(await readFile(
    new URL("contracts/public/square.payment.execute.v1/input.schema.json", directory), "utf8",
  ))
  const result = JSON.parse(await readFile(
    new URL("contracts/public/square.payment.execute.v1/output.schema.json", directory), "utf8",
  ))
  const refundContract = JSON.parse(await readFile(
    new URL("contracts/public/square.payment.refund.v1/input.schema.json", directory), "utf8",
  ))

  assert.equal(manifest.service_type, "destination_adapter")
  assert.deepEqual(manifest.network.outbound_hosts, ["connect.squareupsandbox.com"])
  assert.deepEqual(manifest.secrets, ["SQUARE_SANDBOX_ACCESS_TOKEN"])
  assert.deepEqual(manifest.functions, [])
  assert.equal(contract.$id, "momi://square.payment.execute.v1/input")
  assert.equal(result.$id, "momi://square.payment.execute.v1/output")
  assert.equal(contract.properties.source_token.writeOnly, true)
  assert.equal(refundContract.$id, "momi://square.payment.refund.v1/input")
  assert.equal(manifest.contracts.provides.includes("square.payment.refund.v1"), true)
})
