import assert from "node:assert/strict"
import test from "node:test"
import { verifyDevSupabaseReadAccess } from "../scripts/verify-dev-supabase-read-access.mjs"

const endpoint = "https://api.supabase.com/v1/projects/xtbraqnlskmqxinjxxdn/health?services=auth&timeout_ms=2000"
const token = "sbp_fixture_not_a_credential"
const marker = "fixture-private-response-must-not-escape"
const service = { name: "auth", healthy: true, status: "ACTIVE_HEALTHY" }
const diagnostic = (status) => ({ endpoint: "dev_service_health", http_status: status })

async function run(options = {}, credential = token) {
  const requests = []
  const logs = []
  const signals = []
  let bodyReads = 0
  let cancelled = false
  let error
  const chunks = options.chunks ?? [new TextEncoder().encode(
    options.invalidJson ? marker : JSON.stringify(options.body ?? [service]),
  )]
  const runtime = {
    log: (value) => logs.push(JSON.parse(value)),
    fetch: async (url, request) => {
      requests.push(url)
      signals.push(request.signal)
      assert.equal(request.method ?? "GET", "GET")
      assert.equal(request.redirect, "error")
      assert.equal(request.headers.Authorization, `Bearer ${credential}`)
      assert.equal(request.signal.aborted, false)
      if (options.networkError) throw new Error(marker)
      const stalled = () => new Promise((_, reject) => {
        request.signal.addEventListener("abort", () => reject(new Error(marker)), { once: true })
      })
      if (options.stallHeaders) return stalled()
      let next = 0
      return {
        status: options.status ?? 200,
        get headers() { throw new Error("response headers must not be read") },
        body: { getReader: () => ({
          read: async () => {
            bodyReads++
            if (options.stallBody) return stalled()
            if (options.streamError) throw new Error(marker)
            return next < chunks.length ? { done: false, value: chunks[next++] } : { done: true }
          },
          cancel: async () => { cancelled = true; if (options.cancelError) throw new Error(marker) },
        }) },
      }
    },
  }
  try { await verifyDevSupabaseReadAccess(credential, runtime) } catch (failure) { error = failure.message }
  const output = JSON.stringify({ logs, error })
  assert.ok(!output.includes(marker))
  assert.ok(!output.includes(token))
  assert.doesNotMatch(output, /Authorization|Bearer|db_pass|jwt_secret|"info"|"error":\{/)
  assert.ok(signals.every((signal) => signal.aborted), "request is closed after every outcome")
  return { requests, logs, bodyReads, cancelled, error }
}

for (const healthy of [true, false]) {
  test(`valid service healthy=${healthy} independently proves read access`, async () => {
    const result = await run({ body: [{ ...service, healthy, info: marker, error: marker }], cancelError: true })
    assert.equal(result.error, undefined)
    assert.deepEqual(result.requests, [endpoint])
    assert.equal(result.cancelled, true)
    assert.deepEqual(result.logs, [diagnostic(200), {
      ...diagnostic(200), authenticated: true, target_read_access_verified: true,
      target_ref_bound: true, service_healthy: healthy, write_authority_tested: false,
    }])
  })
}

for (const status of [201, 204, 301, 401, 403, 404, 429, 500]) {
  test(`HTTP ${status} fails without reading a body or making a fallback request`, async () => {
    const result = await run({ status })
    assert.deepEqual(result.requests, [endpoint])
    assert.deepEqual(result.logs, [diagnostic(status)])
    assert.equal(result.bodyReads, 0)
    assert.equal(result.error, `Supabase dev health read rejected with HTTP ${status}`)
  })
}

test("invalid service records never establish authentication or target access", async () => {
  for (const body of [[], {}, [null], [service, service], [{ ...service, name: "rest" }],
    [{ ...service, healthy: "true" }], [{ ...service, status: "" }], [{ name: "auth" }]]) {
    const result = await run({ body })
    assert.equal(result.error, "Supabase dev health response does not match the requested service")
    assert.deepEqual(result.logs, [diagnostic(200)])
  }
})

test("network, JSON, stream, UTF-8 and cancellation errors cannot escape", async () => {
  const network = await run({ networkError: true })
  assert.equal(network.error, "Supabase dev health request failed")
  assert.deepEqual(network.logs, [])
  for (const options of [{ invalidJson: true }, { streamError: true }, { chunks: [new Uint8Array([255])] }]) {
    const result = await run(options)
    assert.equal(result.error, "Supabase dev health response is unreadable or exceeds its limit")
    assert.deepEqual(result.logs, [diagnostic(200)])
    assert.equal(result.cancelled, true)
  }
})

test("response size is bounded across chunks and reading stops immediately", async () => {
  const result = await run({ chunks: [new Uint8Array(10000), new Uint8Array(6385), new Uint8Array(10000)] })
  assert.equal(result.error, "Supabase dev health response is unreadable or exceeds its limit")
  assert.equal(result.bodyReads, 2)
  assert.equal(result.cancelled, true)
  assert.deepEqual(result.logs, [diagnostic(200)])
})

for (const stage of ["stallHeaders", "stallBody"]) {
  test(`five-second deadline aborts a stalled ${stage}`, { timeout: 10000 }, async () => {
    const result = await run({ [stage]: true })
    assert.match(result.error, /request failed|response is unreadable/)
    assert.deepEqual(result.requests, [endpoint])
    assert.deepEqual(result.logs, stage === "stallHeaders" ? [] : [diagnostic(200)])
  })
}

test("invalid credentials never reach the network", async () => {
  for (const credential of ["", "invalid fixture", "sbp_invalid\nfixture"]) {
    const result = await run({}, credential)
    assert.equal(result.error, "SUPABASE_ACCESS_TOKEN is missing or malformed")
    assert.deepEqual(result.requests, [])
    assert.deepEqual(result.logs, [])
  }
})
