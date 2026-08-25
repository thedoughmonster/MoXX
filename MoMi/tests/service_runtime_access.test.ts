import assert from "node:assert/strict"
import { join } from "node:path"
import test from "node:test"

import type { SourceModule } from "../scripts/architecture/types.ts"
import { findRuntimeAccessFindings } from
  "../scripts/constitution/find_runtime_access_findings.ts"
import { service } from "./fixtures/service_constitution_fixture.ts"

test("ratchets direct reads and writes of another owner's relation", () => {
  const owner = service("records-owner")
  const consumer = service("records-consumer")
  delete consumer.manifest.owned_dataset
  consumer.manifest.service_type = "read_facade"
  const module = (source: string): SourceModule => ({
    path: join(consumer.directory, "src", "access.ts"),
    service_key: consumer.manifest.service_key,
    source: `sql\`${source}\``,
    imports: [],
  })
  const read = findRuntimeAccessFindings(
    [owner, consumer],
    [module("select * from fixture_records.items")],
  )
  const write = findRuntimeAccessFindings(
    [owner, consumer],
    [module("insert into fixture_records.items (id) values (1)")],
  )
  assert.equal(read[0].evidence.access, "read")
  assert.equal(write[0].evidence.access, "write")
})

test("allows only an exact consumed public relation read", () => {
  const owner = service("records-owner")
  const consumer = service("records-consumer")
  delete consumer.manifest.owned_dataset
  consumer.manifest.service_type = "read_facade"
  const contract = "fixture.records.read.v1"
  owner.manifest.owned_dataset!.public_relation_reads = [{
    contract,
    relation: "fixture_records.items",
  }]
  consumer.manifest.contracts.consumes = [{
    service: "records-owner",
    contract,
  }]
  const module: SourceModule = {
    path: join(consumer.directory, "src", "read.ts"),
    service_key: consumer.manifest.service_key,
    source: "sql`select * from fixture_records.items`",
    imports: [],
  }
  assert.deepEqual(findRuntimeAccessFindings([owner, consumer], [module]), [])
  module.source = "sql`delete from fixture_records.items`"
  assert.equal(
    findRuntimeAccessFindings([owner, consumer], [module])[0].evidence.access,
    "write",
  )
})

test("rejects a public relation read without the exact provider contract", () => {
  const owner = service("records-owner")
  const consumer = service("records-consumer")
  delete consumer.manifest.owned_dataset
  consumer.manifest.service_type = "read_facade"
  owner.manifest.owned_dataset!.public_relation_reads = [{
    contract: "fixture.records.read.v1",
    relation: "fixture_records.items",
  }]
  const findings = findRuntimeAccessFindings([owner, consumer], [{
    path: join(consumer.directory, "src", "read.ts"),
    service_key: consumer.manifest.service_key,
    source: "sql`select * from fixture_records.items`",
    imports: [],
  }])
  assert.equal(findings[0].rule_id, "direct_private_relation_access")
})

test("fingerprints dynamic SQL identifiers", () => {
  const owner = service("records-owner")
  const findings = findRuntimeAccessFindings([owner], [{
    path: join(owner.directory, "src", "dynamic.ts"),
    service_key: owner.manifest.service_key,
    source: "const identifier = sql(tableName)",
    imports: [],
  }])
  assert.equal(findings[0].rule_id, "dynamic_relation_identifier")
  assert.equal(findings[0].evidence.expressions, "sql(tableName)")
})

test("rejects raw dynamic and unqualified relation references", () => {
  const owner = service("records-owner")
  const dynamic = findRuntimeAccessFindings([owner], [{
    path: join(owner.directory, "src", "dynamic.ts"),
    service_key: owner.manifest.service_key,
    source: "sql`select * from ${tableName}`",
    imports: [],
  }])
  const unqualified = findRuntimeAccessFindings([owner], [{
    path: join(owner.directory, "src", "unqualified.ts"),
    service_key: owner.manifest.service_key,
    source: "sql`select * from items`",
    imports: [],
  }])
  assert.equal(dynamic[0].rule_id, "dynamic_relation_identifier")
  assert.equal(unqualified[0].rule_id, "unqualified_relation_access")
})
