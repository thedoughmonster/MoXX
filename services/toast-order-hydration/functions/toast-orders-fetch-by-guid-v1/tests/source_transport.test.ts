import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { fetchToastOrder } from "../src/fetch_toast_order.ts"
import { getToastToken } from "../src/get_toast_token.ts"

test("authenticates with the configured Toast client contract", async () => {
  let capturedUrl = ""
  let capturedBody = ""
  const fetchImpl: typeof fetch = (input, init) => {
    capturedUrl = String(input)
    capturedBody = String(init?.body)
    return Promise.resolve(Response.json({
      token: {
        tokenType: "Bearer",
        accessToken: "token-1",
        expiresIn: 3600,
      },
    }))
  }

  const result = await getToastToken({
    api_base_url: "https://toast.example",
    client_id: "client-id",
    client_secret: "client-secret",
    user_access_type: "TOAST_MACHINE_CLIENT",
    request_timeout_ms: 5000,
  }, fetchImpl)

  assert.equal(result.ok, true)
  assert.equal(result.access_token, "token-1")
  assert.equal(capturedUrl, "https://toast.example/authentication/v1/authentication/login")
  assert.deepEqual(JSON.parse(capturedBody), {
    clientId: "client-id",
    clientSecret: "client-secret",
    userAccessType: "TOAST_MACHINE_CLIENT",
  })
})

test("fetches one configured restaurant order by encoded GUID", async () => {
  let capturedUrl = ""
  let capturedHeaders = new Headers()
  const fetchImpl: typeof fetch = (input, init) => {
    capturedUrl = String(input)
    capturedHeaders = new Headers(init?.headers)
    return Promise.resolve(
      Response.json({ guid: "order/guid", checks: [] }, {
        headers: { "x-request-id": "request-1" },
      }),
    )
  }

  const result = await fetchToastOrder({
    api_base_url: "https://toast.example",
    restaurant_guid: "restaurant-guid",
    order_guid: "order/guid",
    token_type: "Bearer",
    access_token: "token-1",
    request_timeout_ms: 5000,
  }, fetchImpl)

  assert.equal(capturedUrl, "https://toast.example/orders/v2/orders/order%2Fguid")
  assert.equal(capturedHeaders.get("Authorization"), "Bearer token-1")
  assert.equal(
    capturedHeaders.get("Toast-Restaurant-External-ID"),
    "restaurant-guid",
  )
  assert.deepEqual(result.body, { guid: "order/guid", checks: [] })
  assert.equal(result.response_headers["x-request-id"], "request-1")
})

test("uses source-neutral runtime and order work contracts", async () => {
  const [claimSource, persistenceSource] = await Promise.all([
    readFile(new URL("../src/claim_job.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/persist_order_response.ts", import.meta.url), "utf8"),
  ])

  assert.match(claimSource, /momi_runtime\.function_registry/)
  assert.match(claimSource, /momi_runtime\.function_trigger_registry/)
  assert.doesNotMatch(claimSource, /toast_hydration\.function_registry/)
  assert.match(persistenceSource, /momi_orders\.api_invocation_work/)

  for (const column of [
    "source_system",
    "source_work_kind",
    "source_work_id",
    "source_resource_kind",
    "source_version_id",
    "location_id",
    "order_id",
    "api_contract_key",
  ]) {
    assert.match(persistenceSource, new RegExp(`\\b${column}\\b`))
  }

  assert.match(persistenceSource, /'toast'/)
  assert.match(persistenceSource, /'order_hydration_job'/)
  assert.match(persistenceSource, /'order'/)
  assert.doesNotMatch(
    persistenceSource,
    /toast_hydration\.order_api_invocation_work/,
  )
})
