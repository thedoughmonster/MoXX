import assert from "node:assert/strict"
import test from "node:test"

import type { ArchitectureSnapshot } from
  "../scripts/architecture/architecture_snapshot_identity_types.ts"
import { findFunctionCapabilityProjectionDiagnostics } from
  "../scripts/architecture/find_function_capability_projection_diagnostics.ts"
import { digestArchitectureSnapshotIdentity } from
  "../scripts/architecture/digest_architecture_snapshot_identity.ts"
import { provideFunctionCapabilityModel } from
  "../scripts/architecture/provide_function_capability_model.ts"
import { createCapabilityArchitecture } from
  "./function_capability_model_fixture.ts"
import { graphSourceSnapshot } from "./service_dependency_graph_fixture.ts"

test("fails closed on unknown, unconsumed, unsupported, and conflated input", async () => {
  const architecture = createCapabilityArchitecture([{
    key: "caller", consumes: [{ service: "known", contract: "known.call.v1" }],
  }, {
    key: "known", provides: ["known.call.v1"],
  }], [{
    key: "momi.caller.run.v1", owner: "caller",
    direct: ["external_api"],
    called: [{ service: "absent", contract: "absent.call.v1" }],
  }])
  const result = await provideFunctionCapabilityModel(
    architecture, graphSourceSnapshot, graphSourceSnapshot,
  )
  assert.equal(result.projection, undefined)
  const codes = new Set(result.diagnostics.map((item) => item.code))
  assert(codes.has("unsupported_direct_capability"))
  assert(codes.has("direct_transitive_conflation"))
  assert(codes.has("called_contract_not_consumed"))
  assert(codes.has("called_contract_unknown"))
})

test("rejects a called contract missing from its named provider", async () => {
  const architecture = createCapabilityArchitecture([{
    key: "caller", consumes: [{
      service: "provider", contract: "provider.missing.v1",
    }],
  }, {
    key: "provider", provides: ["provider.actual.v1"],
  }], [{
    key: "momi.caller.run.v1", owner: "caller",
    called: [{ service: "provider", contract: "provider.missing.v1" }],
  }])
  const result = await provideFunctionCapabilityModel(
    architecture, graphSourceSnapshot, graphSourceSnapshot,
  )
  assert.equal(result.projection, undefined)
  assert(result.diagnostics.some((item) =>
    item.code === "called_contract_unknown" &&
    item.target.includes("provider.missing.v1")))
})

test("fails closed on cycles and stale source identity", async () => {
  const architecture = createCapabilityArchitecture([{
    key: "alpha", provides: ["alpha.call.v1"],
    consumes: [{ service: "beta", contract: "beta.call.v1" }],
  }, {
    key: "beta", provides: ["beta.call.v1"],
    consumes: [{ service: "alpha", contract: "alpha.call.v1" }],
  }], [{
    key: "momi.alpha.run.v1", owner: "alpha",
    called: [{ service: "beta", contract: "beta.call.v1" }],
  }])
  const cycle = await provideFunctionCapabilityModel(
    architecture, graphSourceSnapshot, graphSourceSnapshot,
  )
  const cycleDiagnostic = cycle.diagnostics.find((item) =>
    item.code === "dependency_cycle")
  assert.deepEqual(cycleDiagnostic?.provenance,
    ["service-dependency-graph/v2", "cycle_detected"])
  const valid = createCapabilityArchitecture([{ key: "solo" }], [{
    key: "momi.solo.run.v1", owner: "solo",
  }])
  const stale = structuredClone(graphSourceSnapshot) as ArchitectureSnapshot
  stale.digest = "0".repeat(64)
  const source = await provideFunctionCapabilityModel(
    valid, stale, graphSourceSnapshot,
  )
  const sourceDiagnostic = source.diagnostics.find((item) =>
    item.code === "source_snapshot_stale")
  assert.deepEqual(sourceDiagnostic?.provenance,
    ["architecture-snapshot-identity/v2", "candidate"])
  const oldVersion = structuredClone(graphSourceSnapshot) as ArchitectureSnapshot
  const oldIdentity = oldVersion.identity as unknown as Record<string, unknown>
  oldIdentity.architecture_contract_version = 1
  oldVersion.digest = digestArchitectureSnapshotIdentity(oldVersion.identity)
  const old = await provideFunctionCapabilityModel(
    valid, oldVersion, graphSourceSnapshot,
  )
  assert(old.diagnostics.some((item) => item.code === "source_snapshot_stale"))
  const oldCommit = structuredClone(graphSourceSnapshot) as ArchitectureSnapshot
  oldCommit.identity.commit = "a".repeat(40)
  oldCommit.digest = digestArchitectureSnapshotIdentity(oldCommit.identity)
  const validOld = await provideFunctionCapabilityModel(
    valid, oldCommit, graphSourceSnapshot,
  )
  assert(validOld.diagnostics.some((item) =>
    item.code === "source_snapshot_stale"))
})

test("detects missing effect source and provenance", async () => {
  const architecture = createCapabilityArchitecture([{
    key: "caller", consumes: [{ service: "provider", contract: "call.v1" }],
  }, {
    key: "provider", provides: ["call.v1"], hosts: ["example.test"],
  }], [{
    key: "momi.caller.run.v1", owner: "caller",
    called: [{ service: "provider", contract: "call.v1" }],
  }])
  const result = await provideFunctionCapabilityModel(
    architecture, graphSourceSnapshot, graphSourceSnapshot,
  )
  assert(result.projection)
  const broken = structuredClone(result.projection)
  broken.functions[0].transitive_effects[0].source_path = ""
  broken.functions[0].transitive_effects[0].provenance_paths = []
  const codes = new Set(findFunctionCapabilityProjectionDiagnostics(broken)
    .map((item) => item.code))
  assert(codes.has("effect_source_missing"))
  assert(codes.has("provenance_missing"))
})
