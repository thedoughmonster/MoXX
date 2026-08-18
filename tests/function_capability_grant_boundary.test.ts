import assert from "node:assert/strict"
import test from "node:test"

import type { ExecutionAuthority } from
  "../scripts/architecture/execution_authority_types.ts"
import { provideFunctionCapabilityModel } from
  "../scripts/architecture/provide_function_capability_model.ts"
import { validateArchitecture } from
  "../scripts/architecture/validate_architecture.ts"
import { validateFunctionCapabilityGrantBoundary } from
  "../scripts/architecture/validate_function_capability_grant_boundary.ts"
import { positive } from "./execution_authority_test_support.ts"
import { graphSourceSnapshot } from "./service_dependency_graph_fixture.ts"

const architecture = await validateArchitecture()
const result = await provideFunctionCapabilityModel(
  architecture, graphSourceSnapshot, graphSourceSnapshot,
)
if (!result.projection) throw new Error("expected capability projection")
const model = result.projection

function squareGrant(): ExecutionAuthority {
  const grant = structuredClone(positive)
  grant.service = "preorder-operations"
  grant.filesystem = { read: [], write: [] }
  grant.contracts.call = [{
    provider_service: "square-payment-delivery",
    contract: "square.payment.execute.v1",
  }]
  grant.network.connect = []
  grant.secrets.reference = []
  grant.packages.use = []
  grant.external.invoke = []
  return grant
}

test("admits only mapped database namespaces and the exact called contract", () => {
  assert.deepEqual(validateFunctionCapabilityGrantBoundary(model, {
    function_key: "momi.preorder.payment.initiate.v1",
    execution_authority: squareGrant(),
  }), [])
})

test("rejects Square and OpenAI provider effects as caller authority", () => {
  const grant = squareGrant()
  grant.network.connect.push({
    protocol: "https", host: "connect.squareupsandbox.com", port: 443,
  })
  grant.secrets.reference.push("OPENAI_API_KEY")
  grant.packages.use.push("npm:openai@6.35.0")
  grant.external.invoke.push({
    authority_key: "provider.square", operation: "charge", resource: "payment",
  })
  const diagnostics = validateFunctionCapabilityGrantBoundary(model, {
    function_key: "momi.preorder.payment.initiate.v1",
    execution_authority: grant,
  })
  assert.equal(diagnostics.filter((item) =>
    item.code === "positive_namespace_unmapped").length, 4)
})

test("rejects unknown contract, owner, missing, and multi-function selection", () => {
  const grant = squareGrant()
  grant.service = "communications-evaluation"
  grant.contracts.call[0].contract = "square.payment.refund.v1"
  const mismatch = validateFunctionCapabilityGrantBoundary(model, {
    function_key: "momi.preorder.payment.initiate.v1",
    execution_authority: grant,
  })
  assert(mismatch.some((item) =>
    item.field_path === "/execution_authority/service"))
  assert(mismatch.some((item) =>
    item.field_path === "/execution_authority/contracts/call/0"))
  assert(validateFunctionCapabilityGrantBoundary(model, {
    function_key: "",
    execution_authority: squareGrant(),
  }).some((item) => item.code === "function_selection_missing"))
  assert(validateFunctionCapabilityGrantBoundary(model, {
    function_key: [
      "momi.preorder.payment.initiate.v1",
      "momi.communications.evaluate_item.v1",
    ],
    execution_authority: squareGrant(),
  }).some((item) => item.code === "multiple_function_scope"))
})

test("rejects a duplicate selected function identity", () => {
  const duplicate = structuredClone(model)
  duplicate.functions.push({
    ...structuredClone(duplicate.functions[0]),
    manifest_path: duplicate.functions[0].manifest_path.replace(
      "/function.json", "-duplicate/function.json",
    ),
  })
  assert(validateFunctionCapabilityGrantBoundary(duplicate, {
    function_key: duplicate.functions[0].function_key,
    execution_authority: squareGrant(),
  }).some((item) => item.code === "duplicate_function_key"))
})
