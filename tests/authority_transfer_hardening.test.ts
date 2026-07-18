import assert from "node:assert/strict"
import test from "node:test"

import type { AuthoritySnapshot } from
  "../scripts/constitution/load_target_authority_snapshot.ts"
import { findNewMigrationAuthorityViolations } from
  "../scripts/migrations/find_new_migration_authority_violations.ts"
import { service } from "./fixtures/service_constitution_fixture.ts"

test("trusted dev ownership survives candidate declaration removal", () => {
  const owner = service("records-owner")
  const actor = service("records-actor")
  delete actor.manifest.owned_dataset
  actor.manifest.service_type = "read_facade"
  owner.manifest.owned_dataset!.private_relations = []
  const trusted: AuthoritySnapshot = {
    relationOwners: new Map([["fixture_records.items", "records-owner"]]),
    routineOwners: new Map(),
    schemaOwners: new Map([["fixture_records", new Set(["records-owner"])]]),
  }
  const findings = findNewMigrationAuthorityViolations(
    new Map(),
    new Map([["001.sql", "-- service-owner: records-actor\n" +
      "drop table fixture_records.items;"]]),
    [owner, actor],
    trusted,
  )
  assert.match(findings.join("\n"), /records-actor cannot write fixture_records\.items/)
})

test("trusted dev ownership survives candidate routine transfer", () => {
  const owner = service("routine-owner")
  const actor = service("routine-actor")
  owner.manifest.owned_dataset!.private_routines = []
  actor.manifest.owned_dataset!.private_routines = ["fixture_records.mutate"]
  const trusted: AuthoritySnapshot = {
    relationOwners: new Map(),
    routineOwners: new Map([["fixture_records.mutate", "routine-owner"]]),
    schemaOwners: new Map([["fixture_records", new Set(["routine-owner"])]]),
  }
  const sql = "-- service-owner: routine-actor\n" +
    "create or replace function fixture_records.mutate() " +
    "returns bigint language sql as 'select 1';"
  const findings = findNewMigrationAuthorityViolations(
    new Map(), new Map([["002.sql", sql]]), [owner, actor], trusted,
  )
  assert.match(findings.join("\n"), /cannot mutate fixture_records\.mutate/)
})

test("trusted schema ownership survives same-change candidate transfer", () => {
  const owner = service("records-owner")
  const actor = service("records-actor")
  owner.manifest.owned_dataset!.private_schema = undefined
  actor.manifest.owned_dataset!.private_schema = "fixture_records"
  const trusted: AuthoritySnapshot = {
    relationOwners: new Map(),
    routineOwners: new Map(),
    schemaOwners: new Map([["fixture_records", new Set(["records-owner"])]]),
  }
  const findings = findNewMigrationAuthorityViolations(
    new Map(),
    new Map([["003.sql", "-- service-owner: records-actor\n" +
      "drop schema fixture_records cascade;"]]),
    [owner, actor],
    trusted,
  )
  assert.match(findings.join("\n"), /owned by records-owner/)
})

test("trusted development history advances after an ownership transfer", () => {
  const former = service("records-owner")
  const actor = service("records-actor")
  former.manifest.owned_dataset!.private_relations = []
  actor.manifest.owned_dataset!.private_relations = ["fixture_records.items"]
  const old = "-- service-owner: records-owner\n" +
    "create table fixture_records.items(id bigint);"
  const current = new Map([
    ["001.sql", old],
    ["002.sql", "-- service-owner: records-actor\n" +
      "alter table fixture_records.items add column label text;"],
  ])
  const trusted: AuthoritySnapshot = {
    relationOwners: new Map([["fixture_records.items", "records-actor"]]),
    routineOwners: new Map(),
    schemaOwners: new Map([["fixture_records", new Set(["records-actor"])]]),
  }
  assert.deepEqual(findNewMigrationAuthorityViolations(
    new Map([["001.sql", "git-blob-sha1:trusted"]]),
    current,
    [former, actor],
    trusted,
  ), [])
})
