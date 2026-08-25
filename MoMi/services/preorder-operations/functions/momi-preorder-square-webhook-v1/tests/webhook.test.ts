import assert from "node:assert/strict"
import test from "node:test"

import { processWebhook } from "../src/process_webhook.ts"
import { readWebhookIdentity } from "../src/read_webhook_identity.ts"
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

test("returns 503 without resolution when archive capture fails", async () => {
  const calls: string[] = []
  const deps = dependencies(calls)
  deps.capture = () => {
    calls.push("capture")
    return Promise.reject(new Error("archive unavailable"))
  }
  const response = await processWebhook(request(), deps)
  assert.equal(response.status, 503)
  assert.deepEqual(calls.map((call) => call.split(":")[0]), [
    "authenticate", "capture",
  ])
})

test("returns 503 after durable capture when projection fails", async () => {
  const calls: string[] = []
  const deps = dependencies(calls)
  deps.project = () => {
    calls.push("project")
    return Promise.reject(new Error("projection unavailable"))
  }
  const response = await processWebhook(request(), deps)
  assert.equal(response.status, 503)
  assert.deepEqual(calls.map((call) => call.split(":")[0]), [
    "authenticate", "capture", "resolve", "project",
  ])
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


test("keeps one archive identity across transient and successful replay", async () => {
  const calls: string[] = []
  const deps = dependencies(calls)
  const authenticated = deps.authenticate
  const identities: string[] = []
  deps.capture = (_raw, _payload, context) => {
    identities.push(context.evidenceId)
    return Promise.resolve({ disposition: "stored", archiveItemId: "archive",
      contentHash: "a".repeat(64) })
  }
  deps.authenticate = () => Promise.resolve({ disposition: "retryable",
    evidence: null, error_code: "provider_indeterminate" })
  const first = await processWebhook(request(), deps)
  deps.authenticate = authenticated
  const second = await processWebhook(request(), deps)
  assert.equal(first.status, 503)
  assert.equal(second.status, 200)
  assert.equal(identities[0], identities[1])
  assert.match(identities[0], /^square:webhook:event:payment\.updated:square-event$/)
})

test("namespaces provider fixture identities by event type", () => {
  const eventId = "bc316346-6691-4243-88ed-6d651a0d0c47"
  const created = readWebhookIdentity(
    { event_id: eventId, type: "refund.created" }, "a".repeat(64),
  )
  const updated = readWebhookIdentity(
    { event_id: eventId, type: "refund.updated" }, "b".repeat(64),
  )
  assert.notEqual(created, updated)
  assert.equal(created, `square:webhook:event:refund.created:${eventId}`)
  assert.equal(updated, `square:webhook:event:refund.updated:${eventId}`)
})

test("rejects oversized requests before authentication", async () => {
  const calls: string[] = []
  const response = await processWebhook(
    request("x".repeat(262_145)), dependencies(calls),
  )
  assert.equal(response.status, 413)
  assert.deepEqual(calls, [])
})
