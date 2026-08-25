import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const readSource = (name: string) =>
  readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8")

test("uses only source-neutral work, runtime, and alerting contracts", () => {
  const claim = readSource("claim_work.ts")
  const complete = readSource("complete_work.ts")
  const failure = readSource("record_failure.ts")
  assert.match(claim, /momi_orders\.api_invocation_work/)
  assert.match(claim, /momi_runtime\.function_registry/)
  assert.match(claim, /momi_runtime\.function_trigger_registry/)
  assert.match(claim, /trigger\.trigger_type = 'durable_http'/)
  assert.match(complete, /momi_alerting\.claim_order_alert_candidates/)
  assert.match(complete, /order\.order_presentation/)
  assert.match(complete, /order\.order_version_id/)
  assert.match(complete, /sql\.json\(order\.order_document\)/)
  assert.match(complete, /sql\.json\(order\.provenance\)/)
  assert.match(complete, /sql\.json\(payload\)/)
  assert.match(complete, /momi_orders\.api_invocation_attempts/)
  assert.match(failure, /momi_orders\.api_invocation_work/)
  assert.equal(failure.match(/\$\{httpStatus\}::integer/g)?.length, 2)
  assert.match(failure, /'error_code', \$\{errorCode\}::text/)
  assert.doesNotMatch(`${claim}${complete}${failure}`, /toast_|slack_|raw\./i)
})

test("keeps the source API contract key and route data-driven", () => {
  const claim = readSource("claim_work.ts")
  const transport = readSource("call_order_api.ts")
  assert.doesNotMatch(`${claim}${transport}`, /momi\.(toast|square)_orders/i)
  assert.match(transport, /job\.api_route_path/)
  assert.match(transport, /order_id: job\.order_id/)
})
