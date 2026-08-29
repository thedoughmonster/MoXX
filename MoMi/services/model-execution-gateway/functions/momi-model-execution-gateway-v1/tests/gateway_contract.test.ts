import assert from "node:assert/strict"
import test from "node:test"

import { authenticateCaller } from "../src/authenticate_caller.ts"
import { hashPayload } from "../src/hash_payload.ts"
import { parseRequest } from "../src/parse_request.ts"
import { providerRequest } from "../src/provider_request.ts"
import { providerStatus } from "../src/provider_status.ts"
import { providerUsage } from "../src/provider_usage.ts"
import type { Admission, CreateRequest } from "../src/types.ts"

const create: CreateRequest = {
  schema_version: 1,
  operation: "create",
  purpose_key: "communications.answer",
  profile_key: "standard",
  parent_invocation_id: "turn-1",
  idempotency_key: "turn-1:answer:1",
  deadline_at: new Date(Date.now() + 60_000).toISOString(),
  requested_output_tokens: 7000,
  background: false,
  payload: { input: "bounded prompt" },
}

const admission: Admission = {
  disposition: "admitted",
  call_id: "00000000-0000-4000-8000-000000000001",
  status: "admitted",
  provider_endpoint: "https://api.openai.com/v1/responses",
  provider_model: "mapped-model",
  reasoning_effort: "medium",
  maximum_output_tokens: 4000,
  timeout_seconds: 60,
  x_client_request_id: "00000000-0000-4000-8000-000000000002",
  provider_response_id: null,
  input_micros_per_token: "2.5",
  output_micros_per_token: "10",
}

test("caller identity is purpose-bound and compared without value exposure", async () => {
  const read = (name: string) => name === "MOMI_MODEL_GATEWAY_COMMUNICATIONS_SECRET"
    ? "communications-only" : undefined
  assert.equal(await authenticateCaller("Bearer communications-only", read),
    "communications-gateway")
  assert.equal(await authenticateCaller("Bearer wrong-secret", read), null)
})

test("retired triage credential grants no caller identity", async () => {
  const secretName = ["MOMI", "MODEL", "GATEWAY", "TRIAGE", "SECRET"].join("_")
  const read = (name: string) => name === secretName ? "retired-only" : undefined
  assert.equal(await authenticateCaller("Bearer retired-only", read), null)
})

test("callers cannot choose provider controls", () => {
  assert.deepEqual(parseRequest(create), create)
  for (const key of ["model", "reasoning", "max_output_tokens", "store",
    "background", "endpoint"]) {
    assert.equal(parseRequest({ ...create, payload: { ...create.payload, [key]: true } }),
      null)
  }
})

test("semantic idempotency ignores deadline and JSON member order", async () => {
  const reordered = { ...create,
    deadline_at: new Date(Date.now() + 120_000).toISOString(),
    payload: { text: { format: "plain" }, input: "bounded prompt" } }
  const equivalent = { ...create, payload: {
    input: "bounded prompt", text: { format: "plain" } } }
  assert.equal(await hashPayload(reordered), await hashPayload(equivalent))
  assert.notEqual(await hashPayload(create), await hashPayload(equivalent))
})

test("mapped provider controls override no caller value and cap output", () => {
  assert.deepEqual(providerRequest(create, admission), {
    input: "bounded prompt",
    model: "mapped-model",
    reasoning: { effort: "medium" },
    max_output_tokens: 4000,
    store: false,
  })
})

test("usage and terminal status become metadata-only evidence", () => {
  const body = { status: "completed", usage: { input_tokens: 100,
    output_tokens: 20, input_tokens_details: { cached_tokens: 80 },
    output_tokens_details: { reasoning_tokens: 5 } } }
  assert.deepEqual(providerUsage(body, "2.5", "10"), {
    input_tokens: 100,
    cached_input_tokens: 80,
    output_tokens: 20,
    reasoning_tokens: 5,
    billed_cost_micros: 450,
  })
  assert.equal(providerStatus(body, true, false), "completed")
  assert.equal(providerStatus({}, false, true), "paid_ambiguous")
})
