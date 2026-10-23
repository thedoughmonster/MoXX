import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { Script } from "node:vm"

const workflow = readFileSync(".github/workflows/supabase-credential-preflight.yml", "utf8")
const source = workflow.match(/<<'NODE'\r?\n([\s\S]*?)\r?\n\s+NODE/)?.[1]
assert.ok(source, "the real workflow's executable preflight must be tested")
const devRef = "xtbraqnlskmqxinjxxdn"
const prodRef = "viodfldzuoypnpqaagag"
const marker = "fixture-private-response-must-not-escape"
const token = "sbp_fixture_not_a_credential"

async function run(responses, environment = "prod", credential = token) {
  const requests = []
  const logs = []
  let bodyReads = 0
  let error
  const result = new Script(`(async () => {${source}\n})()`).runInNewContext({
    process: { env: { SUPABASE_ACCESS_TOKEN: credential, MOXX_TARGET_ENVIRONMENT: environment } },
    console: { log: (value) => logs.push(JSON.parse(value)) },
    fetch: async (url, options) => {
      requests.push(url)
      assert.equal(options.method ?? "GET", "GET")
      assert.equal(options.redirect, "error")
      assert.equal(options.headers.Authorization, `Bearer ${credential}`)
      const response = responses[requests.length - 1]
      assert.ok(response, "unexpected extra request")
      if (response.networkError) throw new Error(marker)
      return {
        status: response.status,
        ok: response.status >= 200 && response.status < 300,
        get headers() { throw new Error("response headers must not be inspected") },
        json: async () => {
          bodyReads++
          if (response.invalidJson) throw new Error(marker)
          return response.body
        },
      }
    },
  })
  try { await result } catch (failure) { error = failure.message }
  const output = JSON.stringify({ logs, error })
  assert.ok(!output.includes(marker))
  assert.ok(!output.includes(token))
  assert.doesNotMatch(output, /Authorization|Bearer|db_pass|jwt_secret/)
  return { requests, logs, bodyReads, error }
}

for (const status of [301, 401, 403, 404, 429, 500]) {
  test(`production stops on HTTP ${status} without reading a body or requesting credentials`, async () => {
    const result = await run([{ status, body: { db_pass: marker, jwt_secret: marker } }])
    assert.deepEqual(result.requests, [`https://api.supabase.com/v1/projects/${prodRef}`])
    assert.deepEqual(result.logs, [])
    assert.equal(result.bodyReads, 0)
    assert.equal(result.error, `Supabase API rejected target metadata read with HTTP ${status}`)
  })
}

test("network and JSON failures never echo exception content", async () => {
  const network = await run([{ networkError: true }])
  assert.equal(network.error, "Supabase API request failed")
  assert.deepEqual(network.logs, [])
  assert.equal(network.requests.length, 1)
  const json = await run([{ status: 200, invalidJson: true }])
  assert.equal(json.error, "Supabase API returned non-JSON with HTTP 200")
  assert.deepEqual(json.logs, [])
})

test("invalid metadata and wrong references remain failures", async () => {
  for (const body of [null, [], marker, { ref: devRef }, {}]) {
    const result = await run([{ status: 200, body }])
    assert.match(result.error, /rejected target metadata|mismatched target reference/)
    assert.deepEqual(result.logs, [])
    assert.equal(result.requests.length, 1)
  }
})

test("missing or malformed credentials never produce a request or derived output", async () => {
  for (const credential of ["", "invalid fixture", "sbp_invalid\nfixture"]) {
    const result = await run([], "prod", credential)
    assert.equal(result.error, "SUPABASE_ACCESS_TOKEN is missing or malformed")
    assert.deepEqual(result.requests, [])
    assert.deepEqual(result.logs, [])
  }
})

test("production retains its exact existing read-only mapping checks", async () => {
  const result = await run([
    { status: 200, body: { ref: prodRef, db_pass: marker, jwt_secret: marker } },
    { status: 200, body: { state: "enabled", appliedSuccessfully: true } },
    { status: 200, body: { user_roles: [{ role: "postgres", expires_at: null }] } },
  ], "prod")
  assert.equal(result.error, undefined)
  assert.deepEqual(result.requests, [
    `https://api.supabase.com/v1/projects/${prodRef}`,
    `https://api.supabase.com/v1/projects/${prodRef}/jit-access`,
    `https://api.supabase.com/v1/projects/${prodRef}/database/jit`,
  ])
  assert.deepEqual(result.logs, [{ authenticated: true, environment: "prod",
    permanent_database_mapping: "verified", target_resource: "project",
    target_metadata: "readable", target_reference_matched: true }])
})
