import assert from "node:assert/strict"
import { join } from "node:path"
import test from "node:test"

import { findDynamicSqlExpressions } from
  "../scripts/constitution/find_dynamic_sql_expressions.ts"
import { findRuntimeAccessFindings } from
  "../scripts/constitution/find_runtime_access_findings.ts"
import { service } from "./fixtures/service_constitution_fixture.ts"

test("detects qualified identifier interpolation and dynamic client queries", () => {
  const path = "runtime.ts"
  assert.match(
    findDynamicSqlExpressions(
      path,
      "db`select * from fixture_records.${fragment}`",
    ).join("\n"),
    /\$\{fragment\}/,
  )
  assert.match(
    findDynamicSqlExpressions(
      path,
      'client.query("select * from " + tableName)',
    ).join("\n"),
    /client\.query/,
  )
  assert.match(
    findDynamicSqlExpressions(
      path,
      'const run = client["query"]; run("select * from " + schema + "." + table)',
    ).join("\n"),
    /run\(\.\.\.\)/,
  )
  assert.match(
    findDynamicSqlExpressions(
      path,
      'const run = (client.query).bind(client); run("select " + table)',
    ).join("\n"),
    /run\(\.\.\.\)/,
  )
  for (const source of [
    'const run = client.query; const next = (run); next("select " + table)',
    'const run = client.query; const next = run.bind(client); next("select " + table)',
  ]) assert.match(
    findDynamicSqlExpressions(path, source).join("\n"),
    /next\(\.\.\.\)/,
  )
  for (const source of [
    'const run = client.query; (run)("select " + table)',
    'client.query.call(client, "select " + table)',
    'client["query"].apply(client, ["select " + table])',
    'const method = "unsafe"; sql[method]("select " + table)',
  ]) assert.ok(findDynamicSqlExpressions(path, source).length > 0)
})

test("does not hide a routine behind a homonymous relation", () => {
  const relationOwner = service("relation-owner")
  relationOwner.manifest.owned_dataset!.private_routines = []
  const routineOwner = service("routine-owner")
  routineOwner.manifest.owned_dataset!.private_relations = ["fixture_records.other"]
  const findings = findRuntimeAccessFindings([relationOwner, routineOwner], [{
    path: join(relationOwner.directory, "src", "call.ts"),
    service_key: relationOwner.manifest.service_key,
    source: "sql`select fixture_records.mutate()`",
    imports: [],
  }])
  assert.match(findings.map((item) => item.rule_id).join("\n"),
    /direct_private_routine_call/)
})

test("fingerprints added references to an already baselined object", () => {
  const owner = service("records-owner")
  const consumer = service("records-consumer")
  delete consumer.manifest.owned_dataset
  consumer.manifest.service_type = "read_facade"
  const find = (source: string) => findRuntimeAccessFindings(
    [owner, consumer],
    [{
      path: join(consumer.directory, "src", "read.ts"),
      service_key: consumer.manifest.service_key,
      source,
      imports: [],
    }],
  )[0]
  const once = find("sql`select * from fixture_records.items`")
  const twice = find("sql`select * from fixture_records.items " +
    "union all select * from fixture_records.items`")
  assert.equal(once.evidence.reference_count, "1")
  assert.equal(twice.evidence.reference_count, "2")
  assert.notEqual(once.fingerprint, twice.fingerprint)
})

test("fingerprints the SQL evidence rather than only its reference count", () => {
  const owner = service("records-owner")
  const consumer = service("records-consumer")
  delete consumer.manifest.owned_dataset
  consumer.manifest.service_type = "read_facade"
  const find = (source: string) => findRuntimeAccessFindings(
    [owner, consumer], [{
      path: join(consumer.directory, "src", "mutate.ts"),
      service_key: consumer.manifest.service_key,
      source,
      imports: [],
    }],
  )[0]
  const insert = find("sql`insert into fixture_records.items(id) values (1)`")
  const drop = find("sql`drop table fixture_records.items`")
  assert.notEqual(insert.evidence.sql_source_hash, drop.evidence.sql_source_hash)
  assert.notEqual(insert.fingerprint, drop.fingerprint)
})
