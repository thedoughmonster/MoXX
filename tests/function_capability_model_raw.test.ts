import assert from "node:assert/strict"
import test from "node:test"

import { inspectRawFunctionCapabilityModel } from
  "../scripts/architecture/inspect_raw_function_capability_model.ts"

const base = {
  function_key: "momi.example.call.v1",
  capability_model: {
    schema_version: 1,
    called_contracts: [{ service: "alpha", contract: "momi.alpha.v1" }],
  },
}

test("reports absence without rejecting transitional manifests", () => {
  assert.deepEqual(
    inspectRawFunctionCapabilityModel(
      { function_key: base.function_key }, "services/example/function.json",
    ).map((item) => item.code),
    ["capability_model_absent"],
  )
})

test("rejects shape and unsupported versions before schema loading", () => {
  for (const [value, code] of [
    [{ ...base, capability_model: [] }, "capability_model_shape_invalid"],
    [{ ...base, capability_model: {
      ...base.capability_model, schema_version: 2,
    } }, "unsupported_capability_model_version"],
    [{ ...base, capability_model: {
      ...base.capability_model, called_contracts: "alpha",
    } }, "capability_model_shape_invalid"],
  ] as const) assert(
    inspectRawFunctionCapabilityModel(value, "services/example/function.json")
      .some((item) => item.code === code),
  )
})

test("rejects duplicate and unsorted called-contract tuples", () => {
  const alpha = { service: "alpha", contract: "momi.alpha.v1" }
  const zeta = { service: "zeta", contract: "momi.zeta.v1" }
  const diagnostics = inspectRawFunctionCapabilityModel({
    ...base,
    capability_model: {
      schema_version: 1,
      called_contracts: [zeta, alpha, alpha],
    },
  }, "services/example/function.json")
  assert(diagnostics.some((item) => item.code === "duplicate_called_contract"))
  assert(diagnostics.some((item) => item.code === "called_contracts_unsorted"))
  assert.deepEqual(diagnostics, inspectRawFunctionCapabilityModel({
    ...base,
    capability_model: {
      schema_version: 1,
      called_contracts: [zeta, alpha, alpha],
    },
  }, "services/example/function.json"))
})
