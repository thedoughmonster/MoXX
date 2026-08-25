import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const adapter = new URL(
  "../../../../../supabase/functions/momi-orders-get-by-version-v1/",
  import.meta.url,
)

test("deployment adapter only registers the exact reader", async () => {
  const [index, denoText] = await Promise.all([
    readFile(new URL("index.ts", adapter), "utf8"),
    readFile(new URL("deno.json", adapter), "utf8"),
  ])
  assert.equal(index, [
    'import "edge-runtime"',
    'import { handleRequest } from "../../../services/warehouse-read-api/functions/momi-orders-get-by-version-v1/src/handle_request.ts"',
    "",
    "Deno.serve(handleRequest)",
    "",
  ].join("\n"))
  assert.deepEqual(JSON.parse(denoText), { imports: {
    "edge-runtime": "jsr:@supabase/functions-js@2.110.2/edge-runtime.d.ts",
    "postgres": "npm:postgres@3.4.3",
  } })
})
