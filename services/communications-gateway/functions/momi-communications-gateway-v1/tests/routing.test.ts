import assert from "node:assert/strict"
import test from "node:test"

import { explicitRoute } from "../src/explicit_route.ts"
import { routeDecision } from "../src/route_decision.ts"
import { routerRequest } from "../src/router_request.ts"
import type { ChatInput, RoutingPolicy } from "../src/types.ts"

const profiles: RoutingPolicy["profiles"] = [
  { route_key: "quick", route_rank: 1, provider_model: "luna",
    reasoning_effort: "low", maximum_output_tokens: 1000, automatic_enabled: true },
  { route_key: "standard", route_rank: 2, provider_model: "terra",
    reasoning_effort: "medium", maximum_output_tokens: 4000, automatic_enabled: true },
  { route_key: "deep", route_rank: 3, provider_model: "sol",
    reasoning_effort: "high", maximum_output_tokens: 8000, automatic_enabled: true },
  { route_key: "maximum", route_rank: 4, provider_model: "sol",
    reasoning_effort: "max", maximum_output_tokens: 16000, automatic_enabled: false },
]
const policy: RoutingPolicy = { router_endpoint: "https://api.openai.com/v1/responses",
  router_model: "luna", router_reasoning_effort: "low",
  router_prompt_version: "momi-router-v1", default_route: "standard",
  maximum_route: "deep", profiles }
const input = { messages: [{ role: "user", content: "compare the last four weeks" }],
  user: { id: "c03fbd6e-65b7-4b23-8e65-2e5a8ec00123", email: "user@example.com" } } as ChatInput

test("builds a bounded structured-output router request", () => {
  const request = routerRequest(input, policy)
  assert.equal(request.model, "luna")
  assert.deepEqual(request.reasoning, { effort: "low" })
  assert.equal(request.max_output_tokens, 500)
  assert.equal(request.tools, undefined)
  assert.deepEqual(request.metadata, { momi_router_prompt_version: "momi-router-v1" })
  const format = request.text as { format: { schema: {
    properties: { route: { enum: string[] } } } } }
  assert.deepEqual(format.format.schema.properties.route.enum,
    ["quick", "standard", "deep"])
})

test("accepts an authorized decision and falls back on invalid output", () => {
  const selected = routeDecision({ output: [{ type: "message", content: [{
    type: "output_text", text:
      JSON.stringify({ route: "deep", confidence: 0.8, reason: "multi-step analysis" }) }] }] }, policy)
  assert.equal(selected.route_key, "deep")
  assert.equal(selected.source, "router")
  const fallback = routeDecision({ output: [] }, policy)
  assert.equal(fallback.route_key, "standard")
  assert.equal(fallback.source, "fallback")
})

test("enforces the per-user explicit route ceiling", () => {
  assert.equal(explicitRoute("quick", policy).route_key, "quick")
  assert.throws(() => explicitRoute("maximum", policy), /route_not_authorized/u)
})
