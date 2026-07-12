import assert from "node:assert/strict"
import test from "node:test"

import { isInternalKeyAuthorization } from "../authorize_request.ts"
import { fetchToastOrder } from "../fetch_toast_order.ts"
import { getToastToken } from "../get_toast_token.ts"

test("requires the dedicated internal function key", () => {
  const key = "a".repeat(32)
  assert.equal(isInternalKeyAuthorization(key, key), true)
  assert.equal(isInternalKeyAuthorization("wrong", key), false)
  assert.equal(isInternalKeyAuthorization(key, undefined), false)
})

test("authenticates with the configured Toast client contract", async () => {
  let capturedUrl = ""
  let capturedBody = ""
  const fetchImpl: typeof fetch = async (input, init) => {
    capturedUrl = String(input)
    capturedBody = String(init?.body)
    return Response.json({
      token: {
        tokenType: "Bearer",
        accessToken: "token-1",
        expiresIn: 3600,
      },
    })
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
  const fetchImpl: typeof fetch = async (input, init) => {
    capturedUrl = String(input)
    capturedHeaders = new Headers(init?.headers)
    return Response.json({ guid: "order/guid", checks: [] }, {
      headers: { "x-request-id": "request-1" },
    })
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
