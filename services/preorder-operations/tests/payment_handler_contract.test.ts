import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import Ajv2020 from "ajv/dist/2020.js"

const serviceRoot = new URL("../", import.meta.url)

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(new URL(path, serviceRoot), "utf8"))
}

test("payment handler schemas and manifests are executable contracts", async () => {
  const slugs = [
    "momi-preorder-payment-initiate-v1",
    "momi-preorder-payment-reconcile-v1",
    "momi-preorder-square-webhook-v1",
  ]
  const ajv = new Ajv2020({ strict: false, validateFormats: false })
  for (const slug of slugs) {
    const manifest = await readJson(`functions/${slug}/function.json`)
    const input = await readJson(`functions/${slug}/contracts/input.schema.json`)
    const output = await readJson(`functions/${slug}/contracts/output.schema.json`)
    assert.equal(ajv.validateSchema(input), true, ajv.errorsText())
    assert.equal(ajv.validateSchema(output), true, ajv.errorsText())
    assert.equal(manifest.owner_service, "preorder-operations")
    assert.match(String(manifest.authentication_policy_key),
      /recovery_authority|hmac_sha256/)
  }
})

test("runtime composition imports only declared Square public contracts", async () => {
  const files = [
    "functions/momi-preorder-payment-initiate-v1/src/runtime_dependencies.ts",
    "functions/momi-preorder-payment-reconcile-v1/src/runtime_dependencies.ts",
    "functions/momi-preorder-square-webhook-v1/src/authenticate_webhook.ts",
  ]
  const source = (await Promise.all(files.map((file) =>
    readFile(new URL(file, serviceRoot), "utf8")
  ))).join("\n")
  assert.match(source, /contracts\/public\/square\.payment\.execute\.v1/)
  assert.match(source, /contracts\/public\/square\.payment\.retrieve\.v1/)
  assert.match(source, /contracts\/public\/square\.payment\.webhook\.authenticate\.v1/)
  assert.doesNotMatch(source, /square-payment-(delivery|acquisition)\/src\//)
})

test("database paths enforce claim, archive, resolve, and projection routines", async () => {
  const files = [
    "functions/momi-preorder-payment-initiate-v1/src/claim_payment.ts",
    "functions/momi-preorder-payment-initiate-v1/src/project_payment.ts",
    "functions/momi-preorder-payment-reconcile-v1/src/claim_reconciliation.ts",
    "functions/momi-preorder-square-webhook-v1/src/capture_raw_evidence.ts",
    "functions/momi-preorder-square-webhook-v1/src/resolve_payment.ts",
    "functions/momi-preorder-square-webhook-v1/src/project_payment.ts",
  ]
  const source = (await Promise.all(files.map((file) =>
    readFile(new URL(file, serviceRoot), "utf8")
  ))).join("\n")
  for (const routine of [
    "admit_public_request_v1", "claim_payment_attempt_v1",
    "claim_payment_reconciliation_v1", "capture_raw_json_evidence_v1",
    "resolve_payment_attempt_v1", "project_payment_evidence_v1",
  ]) assert.match(source, new RegExp(routine))
  assert.doesNotMatch(source, /source_token|authorization|cookie|signature/)
})

test("handlers and evidence paths contain no logging or provider payload output", async () => {
  const files = [
    "functions/momi-preorder-payment-initiate-v1/src/handle_request_with_dependencies.ts",
    "functions/momi-preorder-payment-reconcile-v1/src/handle_request_with_dependencies.ts",
    "functions/momi-preorder-square-webhook-v1/src/process_webhook.ts",
    "src/payment_types.ts", "src/indeterminate_payment_evidence.ts",
  ]
  const source = (await Promise.all(files.map((file) =>
    readFile(new URL(file, serviceRoot), "utf8")
  ))).join("\n")
  assert.doesNotMatch(source, /console\.|Sentry|provider_request_id|raw_provider_payload/)
})
