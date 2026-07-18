import assert from "node:assert/strict"
import test from "node:test"

import { findMigrationHistoryViolations } from
  "../scripts/migrations/find_migration_history_violations.ts"
import { findNewMigrationAuthorityViolations } from
  "../scripts/migrations/find_new_migration_authority_violations.ts"
import { loadDevelopmentMigrations } from
  "../scripts/migrations/load_development_migrations.ts"
import { service } from "./fixtures/service_constitution_fixture.ts"

test("rejects new cross-owner migration reads and writes", () => {
  const owner = service("records-owner")
  const consumer = service("records-consumer")
  delete consumer.manifest.owned_dataset
  consumer.manifest.service_type = "read_facade"
  const header = "-- service-owner: records-consumer\n"
  for (const statement of [
    "select * from fixture_records.items;",
    "insert into fixture_records.items (id) values (1);",
  ]) assert.equal(findNewMigrationAuthorityViolations(
    new Map(), new Map([["001.sql", header + statement]]), [owner, consumer],
  ).length, 1)
})

test("allows an exact consumed public view read but never its write", () => {
  const owner = service("records-owner")
  const consumer = service("records-consumer")
  delete consumer.manifest.owned_dataset
  consumer.manifest.service_type = "read_facade"
  owner.manifest.owned_dataset!.private_relations = ["fixture_records.items_v1"]
  owner.manifest.owned_dataset!.public_relation_reads = [{
    contract: "fixture.records.read.v1",
    relation: "fixture_records.items_v1",
  }]
  consumer.manifest.contracts.consumes = [{
    service: "records-owner",
    contract: "fixture.records.read.v1",
  }]
  const header = "-- service-owner: records-consumer\n"
  assert.deepEqual(findNewMigrationAuthorityViolations(
    new Map(),
    new Map([["001.sql", header + "select * from fixture_records.items_v1;"]]),
    [owner, consumer],
  ), [])
  assert.equal(findNewMigrationAuthorityViolations(
    new Map(),
    new Map([["001.sql", header + "delete from fixture_records.items_v1;"]]),
    [owner, consumer],
  ).length, 1)
})

test("allows an owner migration and ignores exact development history", () => {
  const owner = service("records-owner")
  const source = "-- service-owner: records-owner\n" +
    "create table fixture_records.items (id bigint);"
  assert.deepEqual(findNewMigrationAuthorityViolations(
    new Map(), new Map([["001.sql", source]]), [owner],
  ), [])
  assert.deepEqual(findNewMigrationAuthorityViolations(
    new Map([["001.sql", "git-blob-sha1:fixture"]]),
    new Map([["001.sql", source]]),
    [owner],
  ), [])
})

test("rejects unqualified and dynamic relation authority", () => {
  const owner = service("records-owner")
  const header = "-- service-owner: records-owner\n"
  const current = new Map([
    ["001.sql", header + "select * from items;"],
    ["002.sql", header + "execute format('select * from %I', table_name);"],
  ])
  assert.deepEqual(findNewMigrationAuthorityViolations(
    new Map(), current, [owner],
  ), [
    "001.sql: known relation items must be schema-qualified",
    "002.sql: dynamic SQL relation authority is forbidden",
  ])
})

test("labels development migration immutability and pins its ref", () => {
  assert.deepEqual(findMigrationHistoryViolations(
    new Map([["001.sql", "select 1;"]]),
    new Map([["001.sql", "select 2;"]]),
    new Set(),
    "development",
  ), ["001.sql: development migration was modified"])
  const previous = process.env.MOMI_DEV_REF
  process.env.MOMI_DEV_REF = "HEAD"
  try {
    assert.throws(
      () => loadDevelopmentMigrations("supabase/migrations"),
      /MOMI_DEV_REF must be origin\/dev or a full commit SHA/,
    )
  } finally {
    if (previous === undefined) delete process.env.MOMI_DEV_REF
    else process.env.MOMI_DEV_REF = previous
  }
})
