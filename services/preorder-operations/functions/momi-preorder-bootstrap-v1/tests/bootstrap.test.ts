import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { handleRequestWithReader } from "../src/handle_request_with_reader.ts"
import { parseRequest } from "../src/parse_request.ts"

const fixture = JSON.parse(await readFile(new URL(
  "../../../fixtures/bootstrap-response.json", import.meta.url), "utf8")) as {
    data: Record<string, unknown>
  }

test("parses only the frozen bootstrap query", () => {
  assert.deepEqual(parseRequest(new URL(
    "https://example.test/?surface_key=preorder&fulfillment_date=2026-08-01",
  )), { surface_key: "preorder", fulfillment_date: "2026-08-01" })
  assert.equal(parseRequest(new URL(
    "https://example.test/?surface_key=preorder&extra=true",
  )), null)
  assert.equal(parseRequest(new URL(
    "https://example.test/?surface_key=Preorder",
  )), null)
  assert.equal(parseRequest(new URL(
    "https://example.test/?surface_key=preorder&fulfillment_date=2026-02-31",
  )), null)
})

test("returns the customer-safe bootstrap envelope", async () => {
  const response = await handleRequestWithReader(new Request(
    "https://example.test/?surface_key=preorder",
  ), () => Promise.resolve({ admitted: true, data: fixture.data }))
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*")
  assert.equal(body.meta.contract_key, "momi.preorder.bootstrap.read.v1")
  assert.deepEqual(body.data, fixture.data)
})

test("fails closed for rate limits and disabled surfaces", async () => {
  const limited = await handleRequestWithReader(new Request(
    "https://example.test/?surface_key=preorder",
  ), () => Promise.resolve({ admitted: false, data: null }))
  assert.equal(limited.status, 429)
  assert.equal(limited.headers.get("Retry-After"), "60")
  const disabled = await handleRequestWithReader(new Request(
    "https://example.test/?surface_key=preorder",
  ), () => Promise.resolve({ admitted: true, data: null }))
  assert.equal(disabled.status, 409)
})

test("supports preflight and rejects unsupported methods", async () => {
  const preflight = await handleRequestWithReader(new Request(
    "https://example.test/?surface_key=preorder", { method: "OPTIONS" },
  ), () => Promise.resolve({ admitted: false, data: null }))
  assert.equal(preflight.status, 204)
  const rejected = await handleRequestWithReader(new Request(
    "https://example.test/?surface_key=preorder", { method: "POST" },
  ), () => Promise.resolve({ admitted: false, data: null }))
  assert.equal(rejected.status, 405)
})

test("migration keeps preorder storage private and rate bounded", async () => {
  const sql = await readFile(new URL(
    "../../../../../supabase/migrations/20260728204051_create_preorder_bootstrap_foundation.sql",
    import.meta.url), "utf8")
  assert.match(sql, /^-- service-owner: preorder-operations/m)
  assert.match(sql, /create schema momi_preorder/)
  assert.match(sql, /enable row level security/g)
  assert.match(sql, /request_count < 600/)
  assert.match(sql, /grant execute on function momi_preorder\.read_bootstrap_v1/)
  assert.doesNotMatch(sql, /grant .* to (public|anon|authenticated)/i)
})
