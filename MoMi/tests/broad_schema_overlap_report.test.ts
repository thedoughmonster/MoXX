import assert from "node:assert/strict"
import test from "node:test"

import { calculateBroadSchemaOverlapReportRows } from
  "../scripts/architecture/calculate_broad_schema_overlap_report_rows.ts"
import type { DatabaseObjectAuthority } from
  "../scripts/architecture/database_object_authority_types.ts"
import { canonicalJson } from "../scripts/dev_loop/canonical_json.ts"
import type { LegacyAccessGovernanceFinding } from
  "../scripts/constitution/legacy_access_governance_report_types.ts"

const relation = (name: string, owner_service: string) => ({
  identity: { class: "relation" as const, schema: "momi_a", name },
  owner_service, relation_kind: "table" as const,
  source_path: `services/${owner_service}/service.json`,
  json_pointer: `/owned_dataset/private_relations/${name}`,
  replay_identity: `momi_a.${name}`,
})
const authority: DatabaseObjectAuthority = {
  schema_version: "database-object-authority/v1", repository: "owner/repo",
  revision: "1".repeat(40), source_digest: "2".repeat(64),
  authority_digest: "3".repeat(64),
  objects: [relation("same", "owner-service"),
    relation("shared", "owner-service"), {
      identity: { class: "routine", schema: "routine_only", name: "run",
        arguments: [] }, owner_service: "owner-service",
      source_path: "services/owner-service/service.json",
      json_pointer: "/owned_dataset/private_routines/0",
      replay_identity: "routine_only.run()",
    }],
  runtime_compatibility: [
    { service: "owner-service", source_mode: "database.read",
      source_path: "services/owner-service/service.json",
      json_pointer: "/database/read/0",
      scope: { kind: "historical_broad_migration_debt", schema: "momi_a" } },
    { service: "consumer-service", source_mode: "database.read",
      source_path: "services/consumer-service/service.json",
      json_pointer: "/database/read/0",
      scope: { kind: "historical_broad_migration_debt", schema: "momi_a" } },
    { service: "consumer-service", source_mode: "database.write",
      source_path: "services/consumer-service/service.json",
      json_pointer: "/database/write/0",
      scope: { kind: "historical_broad_migration_debt", schema: "momi_a" } },
    { service: "consumer-service", source_mode: "database.read",
      source_path: "services/consumer-service/service.json",
      json_pointer: "/database/read/1",
      scope: { kind: "historical_broad_migration_debt",
        schema: "routine_only" } },
    { service: "consumer-service", source_mode: "database.read",
      source_path: "services/consumer-service/service.json",
      json_pointer: "/database/read/2", scope: { kind: "exact_object",
        object: { class: "relation", schema: "momi_a", name: "same" } } },
  ], migration_ownership: [], public_mappings: [],
  legacy_debt_reference: { path: "docs/service-access-debt-baseline.json",
    schema_version: "service-access-debt-baseline/v1",
    digest: "4".repeat(64) },
}
const debt = ["a", "b"].map((suffix) => ({
  fingerprint: `sha256:${suffix.repeat(64)}`, rule_version: 1 as const,
  rule_id: "direct_private_relation_access" as const,
  subject: `services/consumer-service/source-${suffix}.ts`,
  consumer_service: "consumer-service", owner_service: "owner-service",
  object: { kind: "relation" as const, identity: "momi_a.same" },
  access_mode: "read" as const, reference_count: "1",
  sql_source_hash: `sha256:${suffix.repeat(64)}`,
})) satisfies LegacyAccessGovernanceFinding[]

test("classifies relation-only rows with exact debt modes and one sentinel", () => {
  const rows = calculateBroadSchemaOverlapReportRows(authority, debt)
  assert.deepEqual(Object.fromEntries(["same-owner", "cross-owner",
    "known-direct-debt", "undiscoverable"].map((classification) => [
      classification, rows.filter((row) =>
        row.classification === classification).length,
    ])), { "same-owner": 2, "cross-owner": 3,
    "known-direct-debt": 1, undiscoverable: 1 })
  const known = rows.find((row) =>
    row.classification === "known-direct-debt")!
  assert.deepEqual(known.debt_fingerprints,
    [debt[0]!.fingerprint, debt[1]!.fingerprint])
  const write = rows.filter((row) =>
    row.compatibility_mode === "database.write")
  assert(write.every((row) => row.classification === "cross-owner"))
  const sentinel = rows.find((row) =>
    row.classification === "undiscoverable")!
  assert.equal(sentinel.row_identity,
    '["consumer-service","database.read","routine_only","null",null]')
  assert.equal(rows.some((row) => row.exact_relation !== null &&
    row.exact_relation.class !== "relation"), false)
  assert.equal(rows.some((row) => row.declaration_source.json_pointer ===
    "/database/read/2"), false)
})

test("shuffled accepted inputs produce identical ordered rows", () => {
  const shuffled = structuredClone(authority)
  shuffled.objects.reverse()
  shuffled.runtime_compatibility.reverse()
  assert.equal(canonicalJson(calculateBroadSchemaOverlapReportRows(
    authority, debt,
  )), canonicalJson(calculateBroadSchemaOverlapReportRows(
    shuffled, [...debt].reverse().concat(debt[0]!),
  )))
})
