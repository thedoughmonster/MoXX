import assert from "node:assert/strict"
import test from "node:test"

import { findRoutineInventoryFindings } from
  "../scripts/constitution/find_routine_inventory_findings.ts"
import { replayRoutineInventory } from
  "../scripts/constitution/replay_routine_inventory.ts"
import { replayRoutineDefinitions } from
  "../scripts/constitution/replay_routine_definitions.ts"
import { service } from "./fixtures/service_constitution_fixture.ts"

test("replays routine creation, schema rename, and multi-target drops", () => {
  const migrations = new Map([
    ["001.sql", [
      "create function old_schema.keep() returns void language sql as 'select';",
      "create function old_schema.remove(integer) returns void language sql as 'select';",
      "alter schema old_schema rename to new_schema;",
    ].join("\n")],
    ["002.sql", "drop function public.noop, new_schema.remove(integer);"],
  ])
  assert.deepEqual(
    [...replayRoutineInventory(migrations)],
    ["new_schema.keep"],
  )
})

test("requires one exact owner for every current routine", () => {
  const owner = service("records-owner")
  assert.deepEqual(findRoutineInventoryFindings(
    [owner],
    new Set(["fixture_records.mutate"]),
  ), [])
  assert.deepEqual(
    findRoutineInventoryFindings([owner], new Set(["fixture_records.other"]))
      .map((item) => item.rule_id),
    ["declared_routine_missing", "routine_owner_missing"],
  )
})

test("replays overloads independently by canonical input signature", () => {
  const migrations = new Map([
    ["001.sql", [
      "create function fixture_records.read(p_id bigint) returns bigint " +
        "language sql as 'select 1';",
      "create function fixture_records.read(p_id bigint, p_body jsonb) " +
        "returns bigint language sql as 'select 2';",
    ].join("\n")],
    ["002.sql", "drop function fixture_records.read(bigint);"],
  ])
  const definitions = replayRoutineDefinitions(migrations)
  assert.deepEqual([...definitions.keys()], [
    "fixture_records.read(bigint,jsonb)",
  ])
  assert.deepEqual([...replayRoutineInventory(migrations)], [
    "fixture_records.read",
  ])
})

test("matches PostgreSQL aliases and discarded type modifiers", () => {
  const migrations = new Map([
    ["001.sql", [
      "create function fixture_records.small(int2) returns void language sql as 'select';",
      "create function fixture_records.label(varchar(10)) returns void language sql as 'select';",
    ].join("\n")],
    ["002.sql", [
      "drop function fixture_records.small(smallint);",
      "drop function fixture_records.label(character varying);",
    ].join("\n")],
  ])
  assert.deepEqual([...replayRoutineDefinitions(migrations)], [])
})
