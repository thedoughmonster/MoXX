import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

test("uses only the approved warehouse read path and no HTTP", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url))
  const paths = await readdir(root, { recursive: true })
  for (const path of paths) {
    if (!path.endsWith(".ts") || path.startsWith("tests")) {
      continue
    }
    const source = await readFile(join(root, path), "utf8")
    assert.doesNotMatch(source, /\bfetch\s*\(/)
    assert.equal(source.includes("toast_raw"), false)
  }

  const reader = await readFile(join(root, "read_order.ts"), "utf8")
  assert.match(reader, /from toast_hydration\.order_api_invocation_work/)
  assert.match(reader, /from momi_api\.read_view_registry/)
  assert.match(reader, /from momi_api\.toast_orders_by_guid_v1/)
  assert.match(reader, /work\.status = 'running'/)
  assert.match(reader, /order_view\.order_version_id = work\.work_order_version_id/)
})
