import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import Ajv from "ajv"

const root = new URL("../", import.meta.url)

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(new URL(path, root), "utf8")) as T
}

type OpenApi = {
  paths: Record<string, Record<string, {
    operationId: string
    security?: Array<Record<string, unknown[]>>
    "x-momi-contract-key": string
  }>>
  components: { schemas: Record<string, object> }
}

type Manifest = {
  contracts: { provides: string[] }
  network: { outbound_hosts: string[] }
  secrets: string[]
}

test("manifest and OpenAPI declare the same public contracts", async () => {
  const manifest = await readJson<Manifest>("service.json")
  const api = await readJson<OpenApi>(
    "contracts/preorder-public-v1.openapi.json",
  )
  const operations = Object.entries(api.paths).flatMap(([path, methods]) =>
    Object.values(methods).map((operation) => ({ path, ...operation }))
  )
  const contractKeys = operations.map((operation) =>
    operation["x-momi-contract-key"]
  ).sort()

  assert.deepEqual(contractKeys, [...manifest.contracts.provides].sort())
  assert.equal(new Set(contractKeys).size, contractKeys.length)
  assert.ok(operations.every((operation) =>
    operation.path.startsWith("/momi-preorder-") &&
    operation.path.endsWith("-v1")
  ))
  assert.deepEqual(manifest.network.outbound_hosts, [])
  assert.deepEqual(manifest.secrets, ["SUPABASE_DB_URL"])
})

test("order and payment routes require header authority", async () => {
  const api = await readJson<OpenApi>(
    "contracts/preorder-public-v1.openapi.json",
  )
  const protectedPaths = [
    "/momi-preorder-checkout-hold-v1",
    "/momi-preorder-order-intent-v1",
    "/momi-preorder-payment-initiate-v1",
    "/momi-preorder-payment-reconcile-v1",
    "/momi-preorder-order-status-v1",
    "/momi-preorder-change-request-v1",
  ]

  for (const path of protectedPaths) {
    const operation = Object.values(api.paths[path] ?? {})[0]
    assert.ok(operation?.security?.length, path)
  }
})

test("synthetic bootstrap and quote fixtures match the frozen schemas", async () => {
  const api = await readJson<OpenApi>(
    "contracts/preorder-public-v1.openapi.json",
  )
  const bootstrap = await readJson<object>("fixtures/bootstrap-response.json")
  const quote = await readJson<{ request: object; response: object }>(
    "fixtures/quote-exchange.json",
  )
  const ajv = new Ajv({ strict: false, validateFormats: false })
  ajv.addSchema(api, "preorder")

  const validateBootstrap = ajv.getSchema(
    "preorder#/components/schemas/BootstrapResponse",
  )
  const validateQuoteRequest = ajv.getSchema(
    "preorder#/components/schemas/QuoteRequest",
  )
  const validateQuoteResponse = ajv.getSchema(
    "preorder#/components/schemas/QuoteResponse",
  )

  assert.ok(validateBootstrap)
  assert.ok(validateQuoteRequest)
  assert.ok(validateQuoteResponse)
  assert.equal(validateBootstrap(bootstrap), true, ajv.errorsText(
    validateBootstrap.errors,
  ))
  assert.equal(validateQuoteRequest(quote.request), true, ajv.errorsText(
    validateQuoteRequest.errors,
  ))
  assert.equal(validateQuoteResponse(quote.response), true, ajv.errorsText(
    validateQuoteResponse.errors,
  ))
})

test("synthetic fixtures contain no customer or provider credentials", async () => {
  const fixtureText = [
    await readFile(new URL("fixtures/bootstrap-response.json", root), "utf8"),
    await readFile(new URL("fixtures/quote-exchange.json", root), "utf8"),
  ].join("\n").toLowerCase()

  for (const forbidden of [
    "access_token",
    "authorization:",
    "card_number",
    "customer@example",
    "service_role",
    "square_signature",
  ]) {
    assert.doesNotMatch(fixtureText, new RegExp(forbidden))
  }
})
