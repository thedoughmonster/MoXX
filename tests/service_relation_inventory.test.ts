import assert from "node:assert/strict"
import test from "node:test"

import { findRelationInventoryFindings } from
  "../scripts/constitution/find_relation_inventory_findings.ts"
import { service } from "./fixtures/service_constitution_fixture.ts"

test("requires every migrated relation to have one real declaration", () => {
  const owner = service("records-owner")
  owner.manifest.owned_dataset!.private_relations = [
    "fixture_records.items",
    "fixture_records.unknown",
  ]
  const inventory = new Map([
    ["fixture_records.items", "table"],
    ["fixture_records.missing", "view"],
  ])
  assert.deepEqual(
    findRelationInventoryFindings([owner], inventory).map((item) => item.rule_id),
    ["relation_owner_missing", "relation_declaration_unknown"],
  )
})
