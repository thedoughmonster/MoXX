import assert from "node:assert/strict"
import test from "node:test"
import { handleAdminRequest } from "../src/handle_admin_request.ts"

const endpoint = "https://example.invalid/functions/v1/momi-admin-data-v1/sales/health"
const token = "test_fixture_only_".padEnd(43, "x")

test("admin HTTP denies invalid credentials and request scope before reading data", async () => {
  let reads = 0
  const dependencies = { token, read: async () => { reads++; return {} } }
  for (const [url, authorization, method, status] of [
    [endpoint, "", "GET", 401],
    [endpoint, "Bearer wrong", "GET", 401],
    [endpoint, "Bearer " + token + "x", "GET", 401],
    [endpoint + "?scope=other", "Bearer " + token, "GET", 400],
    [endpoint.replace("sales/health", "team/payroll"), "Bearer " + token, "GET", 404],
    [endpoint, "Bearer " + token, "POST", 405],
  ]) {
    const response = await handleAdminRequest(
      new Request(url, { method, headers: { authorization } }), dependencies)
    assert.equal(response.status, status)
    assert.equal(response.headers.get("cache-control"), "private, no-store")
  }
  assert.equal(reads, 0)
  const unconfigured = await handleAdminRequest(new Request(endpoint),
    { ...dependencies, token: undefined })
  assert.equal(unconfigured.status, 503)
  assert.equal(reads, 0)
  const probe = await handleAdminRequest(
    new Request(endpoint.replace("/sales/health", "")), dependencies)
  assert.equal(probe.status, 200)
  assert.equal(reads, 0)
})

test("admin HTTP returns current aggregate JSON and safe bounded failures", async () => {
  const request = new Request(endpoint, {
    headers: { Authorization: "Bearer " + token },
  })
  const dataset = { schemaVersion: 1, capturedAt: "2026-09-11T08:00:00Z", days: [] }
  const success = await handleAdminRequest(request, {
    token, read: async () => dataset,
  })
  assert.equal(success.status, 200)
  assert.deepEqual(await success.json(), dataset)
  assert.equal(success.headers.get("vary"), "Authorization")
  for (const read of [
    async () => null,
    async () => { throw new Error("private database details") },
    async () => ({ excessive: "x".repeat(2_000_001) }),
  ]) {
    const response = await handleAdminRequest(request, { token, read })
    assert.equal(response.status, 503)
    assert.doesNotMatch(await response.text(), /private database|test_fixture_only|excessive/)
  }
})
