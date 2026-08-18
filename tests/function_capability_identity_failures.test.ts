import assert from "node:assert/strict"
import test from "node:test"

import { canonicalJson } from "../scripts/dev_loop/canonical_json.ts"
import { assertFunctionCapabilityModel } from
  "../scripts/architecture/assert_function_capability_model.ts"
import { findFunctionCapabilityProjectionDiagnostics } from
  "../scripts/architecture/find_function_capability_projection_diagnostics.ts"
import { provideFunctionCapabilityModel } from
  "../scripts/architecture/provide_function_capability_model.ts"
import { createCapabilityArchitecture } from
  "./function_capability_model_fixture.ts"
import { graphSourceSnapshot } from "./service_dependency_graph_fixture.ts"

test("fails closed deterministically on duplicate function identities", async () => {
  const architecture = createCapabilityArchitecture([
    { key: "alpha" }, { key: "beta" },
  ], [{
    key: "momi.duplicate.run.v1", owner: "alpha", slug: "alpha-run-v1",
  }, {
    key: "momi.duplicate.run.v1", owner: "beta", slug: "beta-run-v1",
  }])
  const reversed = {
    services: [...architecture.services].reverse(),
    functions: [...architecture.functions].reverse(),
  }
  const first = await provideFunctionCapabilityModel(
    architecture, graphSourceSnapshot, graphSourceSnapshot,
  )
  const second = await provideFunctionCapabilityModel(
    reversed, graphSourceSnapshot, graphSourceSnapshot,
  )
  assert.equal(first.projection, undefined)
  assert.equal(second.projection, undefined)
  assert.equal(canonicalJson(first.diagnostics), canonicalJson(second.diagnostics))
  assert(first.diagnostics.some((item) =>
    item.code === "duplicate_function_key"))
})

test("rejects duplicate identities in a supplied projection", async () => {
  const architecture = createCapabilityArchitecture([{ key: "solo" }], [{
    key: "momi.solo.run.v1", owner: "solo",
  }])
  const result = await provideFunctionCapabilityModel(
    architecture, graphSourceSnapshot, graphSourceSnapshot,
  )
  assert(result.projection)
  const duplicate = structuredClone(result.projection)
  duplicate.functions.push({
    ...structuredClone(duplicate.functions[0]),
    manifest_path: duplicate.functions[0].manifest_path.replace(
      "/function.json", "-duplicate/function.json",
    ),
  })
  assert(findFunctionCapabilityProjectionDiagnostics(duplicate).some((item) =>
    item.code === "duplicate_function_key"))
})

test("repository assertion rejects a non-current source snapshot", async () => {
  const architecture = createCapabilityArchitecture([{ key: "solo" }], [{
    key: "momi.solo.run.v1", owner: "solo",
  }])
  const result = await provideFunctionCapabilityModel(
    architecture, graphSourceSnapshot, graphSourceSnapshot,
  )
  assert(result.projection)
  await assert.rejects(
    assertFunctionCapabilityModel(result.projection),
    /function capability model mismatch: source_snapshot mismatch/,
  )
})
