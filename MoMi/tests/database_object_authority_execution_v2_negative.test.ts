import assert from "node:assert/strict"
import test from "node:test"

import { canonicalJson } from "../scripts/dev_loop/canonical_json.ts"
import type { ExecutionAuthorityV2 } from
  "../scripts/architecture/execution_authority_v2_types.ts"
import { validateExecutionAuthorityV2 } from
  "../scripts/architecture/validate_execution_authority_v2.ts"
import { schema } from "./execution_authority_test_support.ts"
import { readRoutine, relation, subject, v2Schema } from
  "./database_object_authority_execution_v2.test.ts"

test("fails schema, ambiguous, unknown, mismatch, sequence, and debt authority", async () => {
  const cases: Array<[string, unknown, string]> = [
    ["schema", { class: "schema", schema: "momi_orders", name: "all" },
      "broad_positive_authority"],
    ["unknown", { class: "relation", schema: "momi_orders", name: "missing" },
      "unknown_object"],
    ["mode", relation, "object_mode_mismatch"],
    ["sequence", { class: "sequence", schema: "momi_orders", name: "future_seq" },
      "unknown_object"],
    ["debt", { class: "relation", schema: "legacy", name: "private_table" },
      "debt_derived_authority"],
  ]
  for (const [name, object, code] of cases) {
    const mode = name === "mode" ? "routine.call" : name === "sequence"
      ? "sequence.use" : "relation.read"
    const value = subject([{ object, mode }] as
      ExecutionAuthorityV2["database"]["capabilities"])
    const diagnostics = await validateExecutionAuthorityV2(
      value.grant, v2Schema, schema, value.context,
    )
    assert(diagnostics.some((item) => item.code === code), name)
  }
  const ambiguous = subject([])
  const overload = { class: "routine" as const, schema: "toast_raw",
    name: "overloaded", arguments: ["uuid"] }
  const routine = ambiguous.authority.objects.find((item) =>
    item.identity.class === "routine")!
  ambiguous.authority.objects.push({ ...routine,
    identity: overload }, { ...routine,
    identity: { ...overload, arguments: ["text"] } })
  ambiguous.finalize()
  ambiguous.grant.database.capabilities = [{ object: { class: "routine",
    schema: "toast_raw", name: "overloaded" }, mode: "routine.call" }] as never
  const diagnostics = await validateExecutionAuthorityV2(
    ambiguous.grant, v2Schema, schema, ambiguous.context,
  )
  assert(diagnostics.some((item) => item.code === "ambiguous_object_identity"))
})

test("rejects duplicates and preserves repeated diagnostic order", async () => {
  const value = subject([
    { object: relation, mode: "relation.read" },
    { object: relation, mode: "relation.read" },
  ])
  const first = await validateExecutionAuthorityV2(
    value.grant, v2Schema, schema, value.context,
  )
  const second = await validateExecutionAuthorityV2(
    value.grant, v2Schema, schema, value.context,
  )
  assert(first.some((item) => item.code === "duplicate_authority"))
  assert.equal(canonicalJson(first), canonicalJson(second))
})

test("rejects cross-owner writes, missing mappings, and ambiguous owners", async () => {
  const write = subject([{ object: relation, mode: "relation.write" }])
  write.authority.objects.find((item) => item.identity.class === "relation")!
    .owner_service = "toast-data-acquisition"
  write.finalize()
  const writeDiagnostics = await validateExecutionAuthorityV2(
    write.grant, v2Schema, schema, write.context,
  )
  assert(writeDiagnostics.some((item) => item.code === "cross_owner_target"))
  const missing = subject([{ object: readRoutine,
    mode: "routine.call" }])
  missing.authority.public_mappings = []
  missing.finalize()
  missing.grant.contracts.call = [{ provider_service: "toast-data-acquisition",
    contract: "momi.test.read.v1" }]
  const missingDiagnostics = await validateExecutionAuthorityV2(
    missing.grant, v2Schema, schema, missing.context,
  )
  assert(missingDiagnostics.some((item) => item.code === "public_mapping_missing"))
  const ambiguous = subject([{ object: relation, mode: "relation.read" }])
  const relationObject = ambiguous.authority.objects.find((item) =>
    item.identity.class === "relation")!
  ambiguous.authority.objects.push({ ...relationObject,
    owner_service: "toast-data-acquisition" })
  ambiguous.finalize()
  const ambiguousDiagnostics = await validateExecutionAuthorityV2(
    ambiguous.grant, v2Schema, schema, ambiguous.context,
  )
  assert(ambiguousDiagnostics.some((item) => item.code ===
    "target_owner_ambiguous"))
})
