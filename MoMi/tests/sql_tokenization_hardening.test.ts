import assert from "node:assert/strict"
import test from "node:test"

import { replayRelationInventory } from
  "../scripts/constitution/replay_relation_inventory.ts"
import { replayRoutineInventory } from
  "../scripts/constitution/replay_routine_inventory.ts"
import { findNewMigrationAuthorityViolations } from
  "../scripts/migrations/find_new_migration_authority_violations.ts"
import { stripSqlComments } from "../scripts/sql/strip_sql_comments.ts"
import { assertSupportedPersistentDdl } from
  "../scripts/migrations/assert_supported_persistent_ddl.ts"
import { service } from "./fixtures/service_constitution_fixture.ts"

test("preserves SQL after PostgreSQL dollar-quoted comment markers", () => {
  const sql = "select $tag$--$tag$; delete from fixture_records.items;"
  assert.match(stripSqlComments(sql), /delete from fixture_records\.items/)
  const owner = service("records-owner")
  const consumer = service("records-consumer")
  delete consumer.manifest.owned_dataset
  consumer.manifest.service_type = "read_facade"
  const findings = findNewMigrationAuthorityViolations(
    new Map(),
    new Map([["001.sql", `-- service-owner: records-consumer\n${sql}`]]),
    [owner, consumer],
  )
  assert.match(findings.join("\n"), /cannot write fixture_records\.items/)
})

test("replays persistent DDL after a same-line statement", () => {
  const relations = replayRelationInventory(new Map([[
    "001.sql",
    "select 1; create table fixture_records.hidden (id bigint);",
  ]]))
  const routines = replayRoutineInventory(new Map([[
    "001.sql",
    "select 1; create function fixture_records.hidden() " +
      "returns bigint language sql as 'select 1';",
  ]]))
  assert.equal(relations.get("fixture_records.hidden"), "table")
  assert.ok(routines.has("fixture_records.hidden"))
})

test("does not treat a dollar tag inside an identifier as a quote", () => {
  const source = "select foo$bar$; drop table fixture_records.items;"
  const inventory = replayRelationInventory(new Map([
    ["001.sql", "create table fixture_records.items(id bigint);"],
    ["002.sql", source],
  ]))
  assert.ok(!inventory.has("fixture_records.items"))
  assert.match(stripSqlComments(source), /drop table fixture_records\.items/)
})

test("tracks recursive views and rejects unmodeled persistent forms", () => {
  const inventory = replayRelationInventory(new Map([[
    "001.sql",
    "create recursive view fixture_records.tree as select 1;",
  ]]))
  assert.equal(inventory.get("fixture_records.tree"), "view")
  for (const sql of [
    "select 1 into fixture_records.hidden;",
    "create sequence fixture_records.hidden_seq;",
    "create temp sequence fixture_records.hidden_seq;",
    "create type fixture_records.hidden_type as enum ('x');",
    "alter table all in tablespace old_space set tablespace new_space;",
    "create schema hidden create table hidden.items(id bigint);",
    "create schema hidden create index hidden_idx on fixture_records.items(id);",
    "create schema hidden grant select on fixture_records.items to public;",
  ]) assert.throws(
    () => assertSupportedPersistentDdl("002.sql", sql),
    /unsupported persistent relation DDL/,
  )
})
