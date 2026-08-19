import assert from "node:assert/strict"
import test from "node:test"

import { canonicalJson } from "../scripts/dev_loop/canonical_json.ts"
import { compareUtf16 } from "../scripts/architecture/compare_utf16.ts"
import type { DatabaseObjectAuthority } from "../scripts/architecture/database_object_authority_types.ts"
import { digestDatabaseObjectAuthority } from "../scripts/architecture/digest_database_object_authority.ts"
import type { ExecutionAuthorityV2, ExecutionAuthorityV2Context } from "../scripts/architecture/execution_authority_v2_types.ts"
import { readJson } from "../scripts/architecture/read_json.ts"
import { validateExecutionAuthorityV2 } from "../scripts/architecture/validate_execution_authority_v2.ts"
import { context, positive, schema } from "./execution_authority_test_support.ts"
import { workspaceRoot } from "../scripts/architecture/paths.ts"

export const v2Schema = await readJson<object>(`${workspaceRoot}/schemas/execution-authority-v2.schema.json`)
export const databaseSchema = await readJson<object>(`${workspaceRoot}/schemas/database-object-authority-v1.schema.json`)
export const relation = { class: "relation" as const, schema: "momi_orders", name: "order_headers" }
export const readRoutine = { class: "routine" as const, schema: "toast_raw", name: "read_order_v1", arguments: ["uuid"] }
export const commandRoutine = { class: "routine" as const, schema: "toast_raw", name: "command_order_v1", arguments: ["uuid"] }

export function subject(
  capabilities: ExecutionAuthorityV2["database"]["capabilities"] = [],
) {
  const record = (identity: typeof relation | typeof readRoutine,
    owner_service: string) => ({ identity, owner_service,
      source_path: `services/${owner_service}/service.json`,
      json_pointer: "/owned_dataset/private_relations/0",
      replay_identity: `${identity.schema}.${identity.name}` })
  const authority: DatabaseObjectAuthority = {
    schema_version: "database-object-authority/v1",
    repository: "thedoughmonster/momi-backend", revision: "1".repeat(40),
    source_digest: "2".repeat(64), authority_digest: "3".repeat(64),
    objects: [record(relation, "preorder-operations"),
      record(readRoutine, "toast-data-acquisition"),
      record(commandRoutine, "toast-data-acquisition")],
    runtime_compatibility: [
      { service: "preorder-operations", source_mode: "database.read", source_path: "services/preorder-operations/service.json", json_pointer: "/database/read/0",
        scope: { kind: "historical_broad_migration_debt", schema: "momi_orders" } },
      { service: "preorder-operations", source_mode: "database.write", source_path: "services/preorder-operations/service.json", json_pointer: "/database/write/0",
        scope: { kind: "historical_broad_migration_debt", schema: "momi_orders" } },
      { service: "preorder-operations", source_mode: "database.read", source_path: "services/preorder-operations/service.json", json_pointer: "/database/read/1",
        scope: { kind: "historical_broad_migration_debt", schema: "toast_raw" } },
    ],
    migration_ownership: [],
    public_mappings: [
      { provider_service: "toast-data-acquisition", contract: "momi.test.read.v1",
        mapping_kind: "public_routine_reads", object: readRoutine,
        capability: "routine.call", source_path: "services/toast/service.json",
        json_pointer: "/owned_dataset/public_routine_reads/0" },
      { provider_service: "toast-data-acquisition",
        contract: "momi.test.command.v1", mapping_kind: "public_routine_commands",
        object: commandRoutine, capability: "routine.call",
        source_path: "services/toast/service.json",
        json_pointer: "/owned_dataset/public_routine_commands/0" },
    ],
    legacy_debt_reference: { path: "docs/debt.json",
      schema_version: "debt/v1", digest: "4".repeat(64) },
  }
  const finalizeAuthority = () => {
    for (const field of ["objects", "runtime_compatibility",
      "migration_ownership", "public_mappings"] as const) {
      authority[field].sort((left, right) =>
        compareUtf16(canonicalJson(left), canonicalJson(right)) as never)
    }
    authority.authority_digest = digestDatabaseObjectAuthority(authority)
  }
  finalizeAuthority()
  const grant = structuredClone(positive) as unknown as ExecutionAuthorityV2
  grant.$schema = "../schemas/execution-authority-v2.schema.json"
  grant.schema_version = "execution-authority/v2"
  grant.database = { authority: { repository: authority.repository,
    revision: authority.revision, source_digest: authority.source_digest,
    authority_digest: authority.authority_digest }, capabilities }
  grant.contracts.call = []
  const finalize = () => { finalizeAuthority()
    grant.database.authority.authority_digest = authority.authority_digest }
  const v2Context: ExecutionAuthorityV2Context = {
    ...context, databaseObjectAuthority: authority,
    databaseObjectAuthoritySchema: databaseSchema,
    databaseObjectAuthorityDiagnostics: [],
    services: { ...context.services,
      "preorder-operations": { ...context.services["preorder-operations"]!,
        consumes: ["toast-data-acquisition:momi.test.read.v1",
          "toast-data-acquisition:momi.test.command.v1"] },
      "toast-data-acquisition": {
        ...context.services["toast-data-acquisition"]!,
        provides: ["momi.test.read.v1", "momi.test.command.v1"],
      } },
  }
  return { authority, grant, context: v2Context, finalize }
}
test("admits exact relation read and write without schema authority", async () => {
  const { grant, context: v2Context } = subject([
    { object: relation, mode: "relation.read" },
    { object: relation, mode: "relation.write" },
  ])
  assert.deepEqual(await validateExecutionAuthorityV2(grant, v2Schema, schema, v2Context), [])
  assert.equal(grant.database.capabilities.length, 2)
})

test("selects mapped routine read versus command runtime compatibility", async () => {
  const read = subject([{ object: readRoutine, mode: "routine.call" }])
  read.grant.contracts.call = [{ provider_service: "toast-data-acquisition",
    contract: "momi.test.read.v1" }]
  assert.deepEqual(await validateExecutionAuthorityV2(read.grant, v2Schema, schema, read.context), [])
  const command = subject([{ object: commandRoutine, mode: "routine.call" }])
  command.grant.contracts.call = [{ provider_service: "toast-data-acquisition",
    contract: "momi.test.command.v1" }]
  const rejected = await validateExecutionAuthorityV2(
    command.grant, v2Schema, schema, command.context,
  )
  assert(rejected.some((item) => item.code === "public_mapping_mismatch"))
  command.authority.runtime_compatibility.push({
    service: "preorder-operations", source_mode: "database.write",
    source_path: "services/preorder-operations/service.json",
    json_pointer: "/database/write/1",
    scope: { kind: "historical_broad_migration_debt", schema: "toast_raw" },
  })
  command.finalize()
  assert.deepEqual(await validateExecutionAuthorityV2(command.grant, v2Schema, schema, command.context), [])
})
