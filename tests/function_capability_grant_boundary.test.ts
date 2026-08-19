import assert from "node:assert/strict"
import test from "node:test"
import type { ExecutionAuthority } from "../scripts/architecture/execution_authority_types.ts"
import { provideFunctionCapabilityModel } from "../scripts/architecture/provide_function_capability_model.ts"
import { validateArchitecture } from "../scripts/architecture/validate_architecture.ts"
import { validateFunctionCapabilityGrantBoundary } from "../scripts/architecture/validate_function_capability_grant_boundary.ts"
import { positive } from "./execution_authority_test_support.ts"
import { graphSourceSnapshot } from "./service_dependency_graph_fixture.ts"
const architecture = await validateArchitecture(); const result = await provideFunctionCapabilityModel(architecture, graphSourceSnapshot, graphSourceSnapshot)
if (!result.projection) throw new Error("expected capability projection")
const model = result.projection
const validate = validateFunctionCapabilityGrantBoundary.bind(null, model)
function grantFor(service = "preorder-operations", calls: ExecutionAuthority["contracts"]["call"] =
  [{ provider_service: "square-payment-delivery", contract: "square.payment.execute.v1" }],
  directDatabase = true): ExecutionAuthority {
  const grant = structuredClone(positive)
  grant.service = service; grant.filesystem = { read: [], write: [] }
  grant.database.read[0].owner_service = service; grant.database.write[0].owner_service = service
  if (!directDatabase) grant.database = { read: [], write: [] }
  grant.contracts.call = calls
  grant.network.connect = []; grant.secrets.reference = []
  grant.packages.use = []; grant.external.invoke = []
  return grant
}
test("admits only mapped database namespaces and the exact called contract", () => {
  assert.deepEqual(validate({ function_key: "momi.preorder.payment.initiate.v1", execution_authority: grantFor() }), [])
})
test("rejects Square and OpenAI provider effects as caller authority", () => {
  const grant = grantFor()
  grant.network.connect.push({ protocol: "https", host: "connect.squareupsandbox.com", port: 443 })
  grant.secrets.reference.push("OPENAI_API_KEY")
  grant.packages.use.push("npm:openai@6.35.0")
  grant.external.invoke.push({ authority_key: "provider.square", operation: "charge", resource: "payment" })
  const diagnostics = validate({ function_key: "momi.preorder.payment.initiate.v1", execution_authority: grant })
  assert.equal(diagnostics.filter((item) => item.code === "positive_namespace_unmapped").length, 4)
})
test("admits reconciliation contract but rejects its provider authority", () => {
  const grant = grantFor("preorder-operations", [{ provider_service: "square-payment-acquisition",
    contract: "square.payment.retrieve.v1" }])
  assert.deepEqual(validate({ function_key: "momi.preorder.payment.reconcile.v1", execution_authority: grant }), [])
  grant.filesystem.read.push("services/square-payment-acquisition/src/retrieve_payment.ts")
  grant.network.connect.push({ protocol: "https", host: "connect.squareupsandbox.com", port: 443 })
  grant.secrets.reference.push("SQUARE_SANDBOX_ACCESS_TOKEN")
  grant.packages.use.push("npm:square@44.0.0")
  grant.external.invoke.push({ authority_key: "provider.square", operation: "retrieve", resource: "payment" })
  const diagnostics = validate({ function_key: "momi.preorder.payment.reconcile.v1", execution_authority: grant })
  assert.equal(diagnostics.filter((item) => item.code === "positive_namespace_unmapped").length, 5)
})
test("admits webhook contracts but rejects provider and archive authority", () => {
  const grant = grantFor("preorder-operations", [{ provider_service: "communications-archive",
    contract: "momi.raw_json.capture_evidence.v1" }, { provider_service: "square-payment-acquisition",
    contract: "square.payment.webhook.authenticate.v1" }])
  assert.deepEqual(validate({ function_key: "momi.preorder.square_webhook.process.v1", execution_authority: grant }), [])
  grant.contracts.call.push({ provider_service: "communications-archive",
    contract: "momi.private.capture.v1" })
  grant.database.write[0] = { owner_service: "communications-archive",
    object_kind: "table", qualified_object: "momi_communications.archive_items" }
  grant.filesystem.read.push("services/square-payment-acquisition/src/webhook.ts")
  grant.network.connect.push({ protocol: "https", host: "connect.squareupsandbox.com", port: 443 })
  grant.secrets.reference.push("SQUARE_WEBHOOK_SIGNATURE_KEY")
  grant.packages.use.push("npm:square@44.0.0")
  grant.external.invoke.push({ authority_key: "provider.square", operation: "authenticate", resource: "webhook" })
  const diagnostics = validate({ function_key: "momi.preorder.square_webhook.process.v1", execution_authority: grant })
  assert.equal(diagnostics.filter((item) => item.code === "positive_namespace_unmapped").length, 7)
})
test("admits only Trello's archive contract and rejects archive authority", () => {
  const grant = grantFor("trello-evidence-ingestion", [{
    provider_service: "communications-archive", contract: "momi.raw_json.capture_evidence.v1",
  }], false)
  assert.deepEqual(validate({ function_key: "trello.webhooks.webhook_ingest.v1",
    execution_authority: grant }), [])
  grant.contracts.call.push({ provider_service: "communications-archive",
    contract: "momi.private.capture.v1" })
  grant.database.read.push({ owner_service: "communications-archive", object_kind: "schema",
    qualified_object: "momi_communications" })
  grant.database.write.push({ owner_service: "communications-archive", object_kind: "routine",
    qualified_object: "momi_communications.capture_raw_json_evidence_v1" },
  { owner_service: "communications-archive", object_kind: "table",
    qualified_object: "momi_communications.archive_items" })
  grant.filesystem.read.push({ path: "services/communications-archive/service.json",
    kind: "file", recursive: false })
  grant.filesystem.write.push({ path: "services/communications-archive/src/private.ts", kind: "file", recursive: false })
  grant.network.connect.push({ protocol: "https", host: "archive.invalid", port: 443 })
  grant.secrets.reference.push("SUPABASE_DB_URL"); grant.packages.use.push("npm:postgres@3.4.3")
  for (const operation of ["runtime", "deployment", "production", "restoration", "destructive"])
    grant.external.invoke.push({ authority_key: `protected.${operation}`, operation, resource: "archive" })
  const diagnostics = validate({ function_key: "trello.webhooks.webhook_ingest.v1", execution_authority: grant })
  assert.equal(diagnostics.filter((item) => item.code === "positive_namespace_unmapped").length, 14)
})
test("admits model contracts but rejects provider and owner authority", () => {
  const grant = grantFor("communications-gateway", [{
    provider_service: "model-execution-gateway",
    contract: "momi.model_execution.execute.v1",
  }, { provider_service: "model-execution-gateway",
    contract: "momi.model_execution.retrieve.v1" }])
  assert.deepEqual(validate({ function_key: "momi.communications.chat_completions.v1",
    execution_authority: grant }), [])
  grant.contracts.call.push({ provider_service: "model-execution-gateway",
    contract: "momi.model_execution.private.v1" })
  grant.database.write[0] = { owner_service: "model-execution-gateway",
    object_kind: "table", qualified_object: "momi_model_execution.calls" }
  grant.filesystem.read.push({ path: "services/model-execution-gateway/src/provider_request.ts",
    kind: "file", recursive: false })
  grant.network.connect.push({ protocol: "https", host: "api.openai.com", port: 443 })
  grant.secrets.reference.push("OPENAI_API_KEY")
  grant.packages.use.push("npm:openai@6.35.0")
  grant.external.invoke.push(
    { authority_key: "provider.openai", operation: "invoke", resource: "response" },
    { authority_key: "provider.openai", operation: "select_endpoint", resource: "api.openai.com" },
    { authority_key: "provider.openai", operation: "select_model", resource: "gpt-5" })
  const diagnostics = validate({ function_key: "momi.communications.chat_completions.v1",
    execution_authority: grant })
  assert.equal(diagnostics.filter((item) =>
    item.code === "positive_namespace_unmapped").length, 9)
})
test("rejects unknown contract, owner, missing, and multi-function selection", () => {
  const grant = grantFor()
  grant.service = "communications-evaluation"
  grant.contracts.call[0].contract = "square.payment.refund.v1"
  const mismatch = validate({ function_key: "momi.preorder.payment.initiate.v1",
    execution_authority: grant })
  assert(mismatch.some((item) => item.field_path === "/execution_authority/service"))
  assert(mismatch.some((item) =>
    item.field_path === "/execution_authority/contracts/call/0"))
  assert(validate({ function_key: "", execution_authority: grantFor() })
    .some((item) => item.code === "function_selection_missing"))
  assert(validate({ function_key: ["momi.preorder.payment.initiate.v1",
    "momi.communications.evaluate_item.v1"], execution_authority: grantFor() })
    .some((item) => item.code === "multiple_function_scope"))
})
test("rejects a duplicate selected function identity", () => {
  const duplicate = structuredClone(model)
  duplicate.functions.push({ ...structuredClone(duplicate.functions[0]),
    manifest_path: duplicate.functions[0].manifest_path.replace(
      "/function.json", "-duplicate/function.json") })
  assert(validateFunctionCapabilityGrantBoundary(duplicate, {
    function_key: duplicate.functions[0].function_key,
    execution_authority: grantFor(),
  }).some((item) => item.code === "duplicate_function_key"))
})
