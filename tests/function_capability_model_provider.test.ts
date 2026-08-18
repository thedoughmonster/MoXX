import assert from "node:assert/strict"
import test from "node:test"

import { canonicalJson } from "../scripts/dev_loop/canonical_json.ts"
import { provideFunctionCapabilityModel } from
  "../scripts/architecture/provide_function_capability_model.ts"
import { validateArchitecture } from
  "../scripts/architecture/validate_architecture.ts"
import { createCapabilityArchitecture } from
  "./function_capability_model_fixture.ts"
import { graphSourceSnapshot } from "./service_dependency_graph_fixture.ts"

test("projects the four adopted consumers without provider authority", async () => {
  const architecture = await validateArchitecture()
  const result = await provideFunctionCapabilityModel(
    architecture, graphSourceSnapshot, graphSourceSnapshot,
  )
  assert(result.projection)
  assert.equal(result.projection.functions.length, 4)
  assert.equal(result.diagnostics.filter((item) =>
    item.code === "capability_model_absent").length, 35)
  const square = result.projection.functions.find((item) =>
    item.function_key === "momi.preorder.payment.initiate.v1")!
  assert.deepEqual(square.direct_capabilities, [
    "database_read", "database_write",
  ])
  assert.deepEqual(square.called_contracts, [{
    service: "square-payment-delivery",
    contract: "square.payment.execute.v1",
  }])
  assert(square.transitive_effects.some((effect) =>
    effect.effect_kind === "network_outbound_host" &&
    effect.target === "connect.squareupsandbox.com"))
  assert(square.transitive_effects.some((effect) =>
    effect.effect_kind === "secret_reference" &&
    effect.target === "SQUARE_SANDBOX_ACCESS_TOKEN"))
  const reconciliation = result.projection.functions.find((item) =>
    item.function_key === "momi.preorder.payment.reconcile.v1")!
  assert.deepEqual(reconciliation.direct_capabilities, [
    "database_read", "database_write",
  ])
  assert.deepEqual(reconciliation.called_contracts, [{
    service: "square-payment-acquisition",
    contract: "square.payment.retrieve.v1",
  }])
  assert(reconciliation.transitive_effects.some((effect) =>
    effect.effect_kind === "network_outbound_host" &&
    effect.target === "connect.squareupsandbox.com"))
  assert(reconciliation.transitive_effects.some((effect) =>
    effect.effect_kind === "secret_reference" &&
    effect.target === "SQUARE_SANDBOX_ACCESS_TOKEN"))
  const webhook = result.projection.functions.find((item) =>
    item.function_key === "momi.preorder.square_webhook.process.v1")!
  assert.deepEqual(webhook.direct_capabilities, [
    "database_read", "database_write",
  ])
  assert.deepEqual(webhook.called_contracts, [{
    service: "communications-archive",
    contract: "momi.raw_json.capture_evidence.v1",
  }, {
    service: "square-payment-acquisition",
    contract: "square.payment.webhook.authenticate.v1",
  }])
  for (const [effect_kind, target] of [
    ["database_write", "momi_communications"],
    ["runtime_dependency", "npm:postgres@3.4.3"],
    ["network_outbound_host", "connect.squareupsandbox.com"],
    ["secret_reference", "SQUARE_WEBHOOK_SIGNATURE_KEY"],
  ]) assert(webhook.transitive_effects.some((effect) =>
    effect.effect_kind === effect_kind && effect.target === target))
  const model = result.projection.functions.find((item) =>
    item.function_key === "momi.communications.evaluate_item.v1")!
  assert(model.transitive_effects.some((effect) =>
    effect.target === "api.openai.com"))
  assert(model.transitive_effects.some((effect) =>
    effect.target === "OPENAI_API_KEY"))
})

test("is byte-stable under discovery reordering", async () => {
  const architecture = await validateArchitecture()
  const first = await provideFunctionCapabilityModel(
    architecture, graphSourceSnapshot, graphSourceSnapshot,
  )
  const second = await provideFunctionCapabilityModel({
    services: [...architecture.services].reverse(),
    functions: [...architecture.functions].reverse(),
  }, graphSourceSnapshot, graphSourceSnapshot)
  assert(first.projection && second.projection)
  assert.equal(canonicalJson(first.projection), canonicalJson(second.projection))
})

test("keeps direct-only, contract-only, multi-hop, and absent states distinct", async () => {
  const architecture = createCapabilityArchitecture([{
    key: "caller", consumes: [{ service: "alpha", contract: "alpha.call.v1" }],
  }, {
    key: "alpha", provides: ["alpha.call.v1"], consumes: [
      { service: "beta", contract: "beta.call.v1" },
      { service: "gamma", contract: "gamma.call.v1" },
    ],
  }, {
    key: "beta", provides: ["beta.call.v1"],
    consumes: [{ service: "gamma", contract: "gamma.call.v1" }],
  }, {
    key: "gamma", provides: ["gamma.call.v1"], hosts: ["example.test"],
  }], [{
    key: "momi.caller.direct.v1", owner: "caller", direct: ["database_read"],
  }, {
    key: "momi.caller.contract.v1", owner: "caller",
    called: [{ service: "alpha", contract: "alpha.call.v1" }],
  }, {
    key: "momi.caller.absent.v1", owner: "caller", absent: true,
  }])
  const result = await provideFunctionCapabilityModel(
    architecture, graphSourceSnapshot, graphSourceSnapshot,
  )
  assert(result.projection)
  assert.equal(result.projection.functions.length, 2)
  assert(result.diagnostics.some((item) =>
    item.function_key === "momi.caller.absent.v1" &&
    item.code === "capability_model_absent"))
  const direct = result.projection.functions.find((item) =>
    item.function_key === "momi.caller.direct.v1")!
  assert.equal(direct.transitive_effects.length, 0)
  const effect = result.projection.functions.find((item) =>
    item.function_key === "momi.caller.contract.v1")!.transitive_effects[0]
  assert.equal(effect.provenance_paths.length, 2)
  assert.equal(new Set(effect.provenance_paths.map(canonicalJson)).size, 2)
})
