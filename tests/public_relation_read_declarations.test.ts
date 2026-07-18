import assert from "node:assert/strict"
import test from "node:test"

import { findPublicRelationReadFindings } from
  "../scripts/constitution/find_public_relation_read_findings.ts"
import { service } from "./fixtures/service_constitution_fixture.ts"

test("requires a public relation read to be owned and declared", () => {
  const owner = service("records-owner")
  owner.manifest.owned_dataset!.public_relation_reads = [{
    contract: "fixture.unknown.read.v1",
    relation: "fixture_records.unknown",
  }]
  assert.deepEqual(
    findPublicRelationReadFindings([owner]).map((item) => item.rule_id),
    [
      "public_relation_read_contract_missing",
      "public_relation_read_not_owned",
      "public_relation_read_not_versioned_view",
    ],
  )
})

test("accepts an exact owned public relation read", () => {
  const owner = service("records-owner")
  owner.manifest.owned_dataset!.private_relations = ["fixture_records.items_v1"]
  owner.manifest.owned_dataset!.public_relation_reads = [{
    contract: "fixture.records.read.v1",
    relation: "fixture_records.items_v1",
  }]
  assert.deepEqual(findPublicRelationReadFindings(
    [owner], new Map([["fixture_records.items_v1", "view"]]),
  ), [])
})

test("rejects a table disguised as a public relation read", () => {
  const owner = service("records-owner")
  owner.manifest.owned_dataset!.private_relations = ["fixture_records.items_v1"]
  owner.manifest.owned_dataset!.public_relation_reads = [{
    contract: "fixture.records.read.v1",
    relation: "fixture_records.items_v1",
  }]
  assert.equal(findPublicRelationReadFindings(
    [owner], new Map([["fixture_records.items_v1", "table"]]),
  )[0].rule_id, "public_relation_read_not_versioned_view")
})
