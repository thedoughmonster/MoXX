import assert from "node:assert/strict"
import test from "node:test"
import { buildHealthResponse } from "../src/build_health_response.ts"
import { isEvaluatorConfigured } from "../src/is_evaluator_configured.ts"

test("requires every evaluator runtime setting", () => {
  const configured = new Map([
    ["SUPABASE_DB_URL", "postgres://configured"],
    ["MOMI_MODEL_EXECUTION_GATEWAY_URL", "https://example.test/gateway"],
    ["MOMI_MODEL_GATEWAY_EVALUATION_SECRET", "configured"],
  ])
  assert.equal(isEvaluatorConfigured((key) => configured.get(key)), true)
  configured.delete("MOMI_MODEL_GATEWAY_EVALUATION_SECRET")
  assert.equal(isEvaluatorConfigured((key) => configured.get(key)), false)
})

test("returns a redacted misconfiguration health response", async () => {
  const response = buildHealthResponse(false)
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), {
    ok: false,
    function_key: "momi.communications.evaluate_item.v1",
    evaluation_job_id: "0",
    disposition: "misconfigured",
  })
})
