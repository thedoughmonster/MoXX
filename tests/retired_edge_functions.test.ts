import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("../", import.meta.url)
const retiredFunctions = [
  "toast-orders-probe",
  "toast-order-alert-eligibility-v1",
]

test("keeps retired Edge Functions out of active source and config", async () => {
  const config = await readFile(new URL("supabase/config.toml", root), "utf8")

  for (const name of retiredFunctions) {
    await assert.rejects(
      access(new URL(`supabase/functions/${name}/`, root)),
      { code: "ENOENT" },
    )
    assert.doesNotMatch(config, new RegExp(`\\[functions\\.${name}\\]`))
  }
})
