import assert from "node:assert/strict"
import test from "node:test"
import { callOrderApi } from "../src/call_order_api.ts"
import type { ClaimedWork } from "../src/types.ts"

const job: ClaimedWork = {
  disposition: "claimed",
  work_id: "8",
  attempt_id: "9",
  invocation_id: "eb4d0412-e4d3-4319-92fd-e6d660bdd812",
  source_system: "square",
  source_version_id: "square-version-7",
  location_id: "location-1",
  order_id: "order-1",
  api_contract_key: "momi.square_orders.get_by_id.v1",
  api_contract_version: 1,
  api_route_path: "/functions/v1/momi-square-orders-get-by-id-v1",
  trigger_token: "4a56f5d8-bce2-4a99-8e79-dd994bf7ea65",
}

test("calls only the exact owned Order API route", async () => {
  let capturedUrl = ""
  let capturedInit: RequestInit | undefined
  const fetcher = (input: URL | RequestInfo, init?: RequestInit) => {
    capturedUrl = String(input)
    capturedInit = init
    return Promise.resolve(
      Response.json({ ok: true }, { headers: { "sb-request-id": "r1" } }),
    )
  }
  const response = await callOrderApi(job, "https://project.supabase.co/",
    "publishable", fetcher)
  assert.equal(capturedUrl,
    "https://project.supabase.co/functions/v1/momi-square-orders-get-by-id-v1")
  assert.equal(capturedInit?.method, "POST")
  assert.equal((capturedInit?.headers as Record<string, string>).apikey,
    "publishable")
  assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
    work_id: "8",
    order_id: "order-1",
    trigger_token: job.trigger_token,
  })
  assert.equal(response.response_headers["sb-request-id"], "r1")
})

test("rejects a registered route outside the Supabase project", async () => {
  let called = false
  const fetcher = () => {
    called = true
    return Promise.resolve(Response.json({ ok: true }))
  }
  await assert.rejects(
    callOrderApi({ ...job, api_route_path: "https://example.com/orders" },
      "https://project.supabase.co", "publishable", fetcher),
    /same-origin/,
  )
  assert.equal(called, false)
})

test("rejects a same-origin route outside the Edge Function boundary", async () => {
  await assert.rejects(
    callOrderApi({ ...job, api_route_path: "/rest/v1/orders" },
      "https://project.supabase.co", "publishable"),
    /same-origin/,
  )
})
