import assert from "node:assert/strict"
import { join } from "node:path"
import test from "node:test"
import type { SourceModule } from "../scripts/architecture/types.ts"
import { findRuntimeAccessFindings } from
  "../scripts/constitution/find_runtime_access_findings.ts"
import { service } from "./fixtures/service_constitution_fixture.ts"
test("normalizes quoted and spaced relation identifiers", () => {
  const owner = service("records-owner")
  const consumer = service("records-consumer")
  delete consumer.manifest.owned_dataset
  consumer.manifest.service_type = "read_facade"
  for (const source of [
    'select * from "fixture_records"."items"',
    "select * from fixture_records . items",
    "select * from fixture_records -- split\n . items",
  ]) {
    const findings = findRuntimeAccessFindings([owner, consumer], [{
      path: join(consumer.directory, "src", "read.ts"),
      service_key: consumer.manifest.service_key,
      source: `sql\`${source}\``,
      imports: [],
    }])
    assert.equal(findings[0].rule_id, "direct_private_relation_access")
  }
})
test("detects dynamic relation interpolation through comments and client aliases", () => {
  const owner = service("records-owner")
  const findings = findRuntimeAccessFindings([owner], [{
    path: join(owner.directory, "src", "dynamic.ts"),
    service_key: owner.manifest.service_key,
    source: "const relation = db(tableName); await db`select * from /* gap */ ${relation}`",
    imports: [],
  }])
  assert.equal(findings[0].rule_id, "dynamic_relation_identifier")
  assert.match(findings[0].evidence.expressions, /db\(tableName\)/)
  assert.match(findings[0].evidence.expressions, /\$\{relation\}/)
})

test("rejects Unicode SQL identifier spellings", () => {
  const owner = service("records-owner")
  const findings = findRuntimeAccessFindings([owner], [{
    path: join(owner.directory, "src", "unicode.ts"),
    service_key: owner.manifest.service_key,
    source: 'sql`select * from U&"fixture_records".U&"items"`',
    imports: [],
  }])
  assert.equal(findings[0].rule_id, "dynamic_relation_identifier")
})

test("never treats relation authority changes as public reads", () => {
  const owner = service("records-owner")
  const consumer = service("records-consumer")
  delete consumer.manifest.owned_dataset
  consumer.manifest.service_type = "read_facade"
  const contract = "fixture.records.read.v1"
  owner.manifest.owned_dataset!.public_relation_reads = [{
    contract,
    relation: "fixture_records.items",
  }]
  consumer.manifest.contracts.consumes = [{ service: "records-owner", contract }]
  const findings = findRuntimeAccessFindings([owner, consumer], [{
    path: join(consumer.directory, "src", "grant.ts"),
    service_key: consumer.manifest.service_key,
    source: "sql`grant all on fixture_records.items to public`",
    imports: [],
  }])
  assert.equal(findings[0].evidence.access, "write")
})

test("ignores non-SQL templates without poisoning later SQL", () => {
  const owner = service("records-owner")
  const consumer = service("records-consumer")
  delete consumer.manifest.owned_dataset
  consumer.manifest.service_type = "read_facade"
  const findings = findRuntimeAccessFindings([owner, consumer], [{
    path: join(consumer.directory, "src", "read.ts"),
    service_key: consumer.manifest.service_key,
    source: "const label = `it's prose`; sql`select * from fixture_records.items`",
    imports: [],
  }])
  assert.equal(findings[0].rule_id, "direct_private_relation_access")
})

test("does not report a declared CTE as an unqualified private relation", () => {
  const owner = service("records-owner")
  owner.manifest.owned_dataset!.private_relations = ["fixture_records.deliveries"]
  const findings = findRuntimeAccessFindings([owner], [{
    path: join(owner.directory, "src", "cte.ts"),
    service_key: owner.manifest.service_key,
    source: "sql`with deliveries as (select 1) select * from deliveries`",
    imports: [],
  }])
  assert.deepEqual(findings, [])
})

test("detects unsafe SQL and freezes its service source scope", () => {
  const owner = service("records-owner")
  const dynamic: SourceModule = {
    path: join(owner.directory, "src", "dynamic.ts"),
    service_key: owner.manifest.service_key,
    source: 'sql.unsafe("select * from " + tableName)',
    imports: [],
  }
  const companion: SourceModule = {
    path: join(owner.directory, "src", "types.ts"),
    service_key: owner.manifest.service_key,
    source: 'export const allowed = "items"',
    imports: [],
  }
  const before = findRuntimeAccessFindings([owner], [dynamic, companion])[0]
  companion.source = 'export const allowed = "other_items"'
  const after = findRuntimeAccessFindings([owner], [dynamic, companion])[0]
  assert.equal(before.rule_id, "dynamic_relation_identifier")
  assert.notEqual(
    before.evidence.service_source_hash,
    after.evidence.service_source_hash,
  )
  assert.notEqual(before.fingerprint, after.fingerprint)
})
