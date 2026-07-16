import assert from "node:assert/strict"
import test from "node:test"

import { callOrderApi } from "../src/call_order_api.ts"
import { exactOrderContractKey, latestOrderContractKey,
  legacyOrderContractKey } from "../src/types.ts"
import type { CanonicalReadCapability, ClaimedWork } from "../src/types.ts"

const orderId = "7bf8f483-c516-4c71-8f80-92c2cc8c25ff"
const exactJob: ClaimedWork = {
  disposition: "claimed", work_id: "8", attempt_id: "9",
  invocation_id: "eb4d0412-e4d3-4319-92fd-e6d660bdd812",
  source_system: "toast",
  source_version_id: "e28479db-b7b6-4354-984d-f56d250c01a7",
  location_id: null, order_id: orderId,
  api_contract_key: exactOrderContractKey, api_contract_version: 1,
  api_route_path: "/functions/v1/momi-orders-get-by-version-v1",
  trigger_token: "4a56f5d8-bce2-4a99-8e79-dd994bf7ea65",
}
const readCapability: CanonicalReadCapability = {
  contract_key: exactOrderContractKey,
  work_id: "501",
  capability_token: "f10902d2-ef2d-4814-9f72-191c3f7f929c",
}
const latestReadCapability: CanonicalReadCapability = {
  ...readCapability, contract_key: latestOrderContractKey,
}
const latestJob: ClaimedWork = {
  ...exactJob, api_contract_key: latestOrderContractKey,
  api_route_path: "/functions/v1/momi-orders-get-by-id-v1",
}
const legacyJob: ClaimedWork = {
  ...exactJob, location_id: "legacy-location", order_id: "legacy-order",
  api_contract_key: legacyOrderContractKey,
  api_route_path: "/functions/v1/momi-toast-orders-get-by-id-v1",
}

test("exact transport sends version identity and scoped capability", async () => {
  let requestBody: unknown
  const fetcher = (_input: URL | RequestInfo, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body))
    return Promise.resolve(Response.json({ ok: true }, {
      headers: { "sb-request-id": "r1" },
    }))
  }
  const response = await callOrderApi(exactJob,
    "https://project.supabase.co/", "publishable", readCapability, fetcher)
  assert.deepEqual(requestBody, { work_id: readCapability.work_id,
    order_id: orderId, capability_token: readCapability.capability_token,
    order_version_id: exactJob.source_version_id })
  assert.equal(response.response_headers["sb-request-id"], "r1")
})

test("latest transport retains capability request compatibility", async () => {
  let requestBody: unknown
  await callOrderApi(latestJob, "https://project.supabase.co/", "publishable",
    latestReadCapability, (_input, init) => {
      requestBody = JSON.parse(String(init?.body))
      return Promise.resolve(Response.json({ ok: true }))
    })
  assert.deepEqual(requestBody, { work_id: latestReadCapability.work_id,
    order_id: orderId,
    capability_token: latestReadCapability.capability_token })
})

test("legacy transport alone sends the alert work token", async () => {
  let requestBody: unknown
  const fetcher = (_input: URL | RequestInfo, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body))
    return Promise.resolve(Response.json({ ok: true }))
  }
  await callOrderApi(legacyJob, "https://project.supabase.co/",
    "publishable", null, fetcher)
  assert.deepEqual(requestBody, { work_id: legacyJob.work_id,
    order_id: legacyJob.order_id, trigger_token: legacyJob.trigger_token })
})

test("rejects missing, swapped, and cross-contract capabilities", async () => {
  let calls = 0
  const fetcher = () => {
    calls += 1
    return Promise.resolve(Response.json({ ok: true }))
  }
  for (const job of [exactJob, latestJob]) {
    const otherCapability = job === exactJob
      ? latestReadCapability : readCapability
    await assert.rejects(callOrderApi(job, "https://project.supabase.co/",
      "publishable", null, fetcher), /read capability/)
    await assert.rejects(callOrderApi(job, "https://project.supabase.co/",
      "publishable", { work_id: "501",
        trigger_token: readCapability.capability_token } as
        unknown as CanonicalReadCapability, fetcher), /read capability/)
    await assert.rejects(callOrderApi(job, "https://project.supabase.co/",
      "publishable", otherCapability, fetcher), /read capability/)
  }
  await assert.rejects(callOrderApi(legacyJob,
    "https://project.supabase.co/", "publishable", readCapability, fetcher),
  /Legacy Order API/)
  assert.equal(calls, 0)
})

test("rejects routes outside the exact Edge Function boundary", async () => {
  await assert.rejects(callOrderApi({ ...exactJob,
    api_route_path: "https://example.com/orders" },
  "https://project.supabase.co", "publishable", readCapability), /same-origin/)
  await assert.rejects(callOrderApi({ ...exactJob,
    api_route_path: "/rest/v1/orders" },
  "https://project.supabase.co", "publishable", readCapability), /same-origin/)
})
