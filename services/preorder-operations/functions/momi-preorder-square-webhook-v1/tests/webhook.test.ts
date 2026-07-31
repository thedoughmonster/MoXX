import assert from "node:assert/strict"
import test from "node:test"

import { processWebhook } from "../src/process_webhook.ts"
import { dependencies } from "./fixture_dependencies.ts"
import { request } from "./fixture_request.ts"

test("authenticates exact bytes, archives, resolves, then projects", async () => {
  const calls: string[] = []
  const response = await processWebhook(request(), dependencies(calls))
  assert.equal(response.status, 200)
  assert.deepEqual(calls.map((call) => call.split(":")[0]), [
    "authenticate", "capture", "resolve", "project",
  ])
  assert.match(calls[0], /raw-provider/)
  assert.match(calls[1], /raw-provider/)
  assert.doesNotMatch(await response.text(), /raw-provider|square-payment/)
})

test("rejects invalid authentication before archive or projection", async () => {
  const calls: string[] = []
  const deps = dependencies(calls)
  deps.authenticate = () => Promise.resolve({
    disposition: "rejected", evidence: null, error_code: "invalid_webhook",
  })
  const response = await processWebhook(request(), deps)
  assert.equal(response.status, 401)
  assert.deepEqual(calls, [])
})

test("archives authenticated ignored events before acknowledgement", async () => {
  const calls: string[] = []
  const deps = dependencies(calls)
  deps.authenticate = () => Promise.resolve({
    disposition: "ignored", evidence: null, error_code: "unowned_provider_event",
  })
  const response = await processWebhook(request(), deps)
  assert.deepEqual(await response.json(), { ok: true, disposition: "ignored" })
  assert.deepEqual(calls.map((call) => call.split(":")[0]), ["capture"])
})

test("archives authenticated retryable evidence before returning 503", async () => {
  const calls: string[] = []
  const deps = dependencies(calls)
  deps.authenticate = () => Promise.resolve({
    disposition: "retryable", evidence: null,
    error_code: "provider_indeterminate",
  })
  const response = await processWebhook(request(), deps)
  assert.equal(response.status, 503)
  assert.deepEqual(calls.map((call) => call.split(":")[0]), ["capture"])
})

test("fails closed on unresolved owner identity", async () => {
  const calls: string[] = []
  const deps = dependencies(calls)
  deps.resolve = () => Promise.resolve(null)
  const response = await processWebhook(request(), deps)
  assert.deepEqual(await response.json(), { ok: true, disposition: "unmatched" })
  assert.equal(calls.includes("project"), false)
})

test("rejects oversized requests before authentication", async () => {
  const calls: string[] = []
  const response = await processWebhook(
    request("x".repeat(262_145)), dependencies(calls),
  )
  assert.equal(response.status, 413)
  assert.deepEqual(calls, [])
})
