import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("../", import.meta.url)

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(new URL(path, root), "utf8")) as T
}

type Manifest = { contracts: { provides: string[] } }
type Compatibility = {
  status: string
  compatibility: string
  active_writer: string
  future_logical_owner: string
  provided_contracts: string[]
}

test("preorder public v1 remains the active additive compatibility surface", async () => {
  const manifest = await readJson<Manifest>("service.json")
  const compatibility = await readJson<Compatibility>(
    "contracts/preorder-public-v1.compatibility.json",
  )

  assert.equal(compatibility.status, "active")
  assert.equal(compatibility.compatibility, "additive")
  assert.equal(compatibility.active_writer, "preorder-operations")
  assert.equal(compatibility.future_logical_owner, "cart-checkout-operations")
  assert.deepEqual(compatibility.provided_contracts, manifest.contracts.provides)
})
