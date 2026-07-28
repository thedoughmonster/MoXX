import assert from "node:assert/strict"
import { join } from "node:path"
import test from "node:test"

import { workspaceRoot } from "../scripts/architecture/paths.ts"
import { loadLocalMigrations } from "../scripts/migrations/load_local_migrations.ts"
import { replayRelationInventory } from
  "../scripts/constitution/replay_relation_inventory.ts"

test("replays the exact current application relation inventory", async () => {
  const migrations = await loadLocalMigrations(join(
    workspaceRoot,
    "supabase",
    "migrations",
  ))
  const inventory = replayRelationInventory(migrations)
  const kinds = [...inventory.values()]
  assert.equal(inventory.size, 138)
  assert.equal(kinds.filter((kind) => kind === "table").length, 107)
  assert.equal(kinds.filter((kind) => kind === "view").length, 31)
  for (const relation of [
    "momi_preorder.catalog_items",
    "momi_preorder.fulfillment_windows",
    "momi_preorder.public_read_rate_buckets",
    "momi_preorder.surfaces",
  ]) assert.equal(inventory.get(relation), "table")
})

test("applies schema moves, relation renames, and drops in statement order", () => {
  const migrations = new Map([
    ["001.sql", "create table old_schema.items (id int);"],
    ["002.sql", "alter schema old_schema rename to next_schema;"],
    ["003.sql", `alter table next_schema.items rename to records;
      alter table next_schema.records set schema final_schema;`],
    ["004.sql", `drop table final_schema.records;
      create view next_schema.records as select 1;`],
    ["005.sql", `alter view next_schema.records rename to current_records;
      alter view next_schema.current_records set schema final_schema;`],
  ])
  assert.deepEqual(
    [...replayRelationInventory(migrations)],
    [["final_schema.current_records", "view"]],
  )
})

test("tracks every schema and applies multi-object and schema drops", () => {
  const migrations = new Map([
    ["001.sql", `create unlogged table public.first (id int);
      create table unlisted.second (id int);
      create view unlisted.third as select 1;`],
    ["002.sql", "drop table public.first, unlisted.second;"],
    ["003.sql", "drop schema unlisted cascade;"],
  ])
  assert.deepEqual([...replayRelationInventory(migrations)], [])
})

test("fails closed on unsupported persistent relation DDL", () => {
  for (const sql of [
    "create table unqualified (id int);",
    "create view unqualified as select 1;",
    "create foreign table public.remote (id int) server external_source;",
  ]) assert.throws(
    () => replayRelationInventory(new Map([["001.sql", sql]])),
    /unsupported persistent relation DDL|unsupported relation drop target/,
  )
})
