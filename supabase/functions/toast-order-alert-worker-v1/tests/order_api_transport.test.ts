import assert from "node:assert/strict"
import test from "node:test"
import { callOrderApi } from "../call_order_api.ts"
import type { ClaimedWork } from "../types.ts"

const job: ClaimedWork = {
  disposition: "claimed",
  work_id: "8",
  attempt_id: "9",
  invocation_id: "eb4d0412-e4d3-4319-92fd-e6d660bdd812",
  order_guid: "order-guid",
  order_version_id: "7",
  api_contract_key: "momi.orders.get_by_guid.v1",
  trigger_token: "4a56f5d8-bce2-4a99-8e79-dd994bf7ea65",
}

test("calls only the exact owned Order API route", async () => {
  let capturedUrl = ""
  let capturedInit: RequestInit | undefined
  const fetcher = async (input: URL | RequestInfo, init?: RequestInit) => {
    capturedUrl = String(input)
    capturedInit = init
    return Response.json({ ok: true }, { headers: { "sb-request-id": "r1" } })
  }
  const response = await callOrderApi(job, "https://project.supabase.co/",
    "publishable", fetcher)
  assert.equal(capturedUrl,
    "https://project.supabase.co/functions/v1/momi-orders-get-by-guid-v1")
  assert.equal(capturedInit?.method, "POST")
  assert.equal((capturedInit?.headers as Record<string, string>).apikey,
    "publishable")
  assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
    work_id: "8",
    order_guid: "order-guid",
    trigger_token: job.trigger_token,
  })
  assert.equal(response.response_headers["sb-request-id"], "r1")
})
