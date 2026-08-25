import assert from "node:assert/strict"
import test from "node:test"

import { canonicalJson } from "../scripts/dev_loop/canonical_json.ts"
import { digestDatabaseObjectAuthority } from
  "../scripts/architecture/digest_database_object_authority.ts"
import type { ExecutionAuthorityV2 } from
  "../scripts/architecture/execution_authority_v2_types.ts"
import { validateExecutionAuthorityV2 } from
  "../scripts/architecture/validate_execution_authority_v2.ts"
import { schema } from "./execution_authority_test_support.ts"
import { readRoutine, relation, subject, v2Schema } from
  "./database_object_authority_execution_v2.test.ts"

test("rejects invalid generated context before capability admission", async () => {
  const capability = [{ object: { class: "relation" as const,
    schema: "momi_orders", name: "missing" }, mode: "relation.read" as const }]
  const badDigest = subject(capability)
  badDigest.authority.authority_digest = "0".repeat(64)
  const digestDiagnostics = await validateExecutionAuthorityV2(
    badDigest.grant, v2Schema, schema, badDigest.context,
  )
  assert(digestDiagnostics.some((item) => item.code === "source_digest_drift"))
  assert(!digestDiagnostics.some((item) => item.code === "unknown_object"))

  const reordered = subject(capability)
  reordered.authority.objects.reverse()
  reordered.authority.authority_digest = digestDatabaseObjectAuthority(
    reordered.authority,
  )
  reordered.grant.database.authority.authority_digest =
    reordered.authority.authority_digest
  const orderDiagnostics = await validateExecutionAuthorityV2(
    reordered.grant, v2Schema, schema, reordered.context,
  )
  assert(orderDiagnostics.some((item) => item.code === "schema_invalid" &&
    item.json_pointer === "/objects"))
  assert(!orderDiagnostics.some((item) => item.code === "unknown_object"))

  const builder = subject(capability)
  builder.context.databaseObjectAuthorityDiagnostics = [{
    subject: "fixture", layer: "target_ownership", source_path: "fixture.json",
    json_pointer: "/objects", code: "conflicting_authority",
    object_class: "relation", canonical_identity: canonicalJson(relation), mode: "",
  }]
  const builderDiagnostics = await validateExecutionAuthorityV2(
    builder.grant, v2Schema, schema, builder.context,
  )
  assert(builderDiagnostics.some((item) => item.code === "conflicting_authority"))
  assert(!builderDiagnostics.some((item) => item.code === "unknown_object"))
})

test("canonicalizes pre-schema identities independent of key order", async () => {
  const firstObject = { class: "schema", schema: "momi_orders", name: "all" }
  const secondObject = { name: "all", schema: "momi_orders", class: "schema" }
  const diagnostics = []
  for (const object of [firstObject, secondObject]) {
    const value = subject([{ object, mode: "relation.read" }] as
      ExecutionAuthorityV2["database"]["capabilities"])
    diagnostics.push((await validateExecutionAuthorityV2(
      value.grant, v2Schema, schema, value.context,
    )).find((item) => item.code === "broad_positive_authority"))
  }
  assert.deepEqual(diagnostics[0], diagnostics[1])
  assert.equal(diagnostics[0]?.canonical_identity, canonicalJson(firstObject))
  assert.equal(diagnostics[0]?.object_class, "schema")
})

test("denies local and cross-owner capabilities for forbidden owners", async () => {
  const local = subject([{ object: relation, mode: "relation.read" }])
  local.grant.forbidden.services = ["preorder-operations", "unrelated-service"]
  const localDiagnostics = await validateExecutionAuthorityV2(
    local.grant, v2Schema, schema, local.context,
  )
  assert(localDiagnostics.some((item) => item.code === "allow_deny_overlap" &&
    item.object_class === "relation"))

  const cross = subject([{ object: readRoutine, mode: "routine.call" }])
  cross.grant.contracts.call = [{ provider_service: "toast-data-acquisition",
    contract: "momi.test.read.v1" }]
  cross.grant.forbidden.services = ["toast-data-acquisition", "unrelated-service"]
  const crossDiagnostics = await validateExecutionAuthorityV2(
    cross.grant, v2Schema, schema, cross.context,
  )
  assert(crossDiagnostics.some((item) => item.code === "allow_deny_overlap" &&
    item.object_class === "routine"))
})
