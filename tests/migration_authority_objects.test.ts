import assert from "node:assert/strict"
import test from "node:test"

import { findNewMigrationAuthorityViolations } from
  "../scripts/migrations/find_new_migration_authority_violations.ts"
import { service } from "./fixtures/service_constitution_fixture.ts"

test("rejects role membership and unmodeled ownership authority", () => {
  const owner = service("records-owner")
  const header = "-- service-owner: records-owner\n"
  for (const sql of [
    "grant svc_records_owner to svc_records_actor",
    "alter role svc_records_actor login",
    "drop owned by svc_records_actor",
    "alter table fixture_records.items owner to svc_records_actor",
    "create schema hidden authorization svc_records_actor",
    "alter default privileges grant select on tables to public",
    "reset session authorization",
  ]) assert.match(findNewMigrationAuthorityViolations(
    new Map(), new Map([["001.sql", header + sql]]), [owner],
  ).join("\n"), /role and ownership authority is not yet modeled/)
})

test("pins index mutation authority to its owning relation", () => {
  const owner = service("records-owner")
  const actor = service("records-actor")
  delete actor.manifest.owned_dataset
  actor.manifest.service_type = "read_facade"
  const existing = "-- service-owner: records-owner\n" +
    "create index items_key on fixture_records.items(id);"
  const current = new Map([
    ["001.sql", existing],
    ["002.sql", "-- service-owner: records-actor\n" +
      "drop index fixture_records.items_key;"],
  ])
  const findings = findNewMigrationAuthorityViolations(
    new Map([["001.sql", "git-blob-sha1:trusted"]]), current, [owner, actor],
  )
  assert.match(findings.join("\n"), /cannot mutate index fixture_records\.items_key/)
})

test("checks both indexes when attaching an index partition", () => {
  const owner = service("records-owner")
  const actor = service("records-actor")
  actor.manifest.owned_dataset!.private_relations = ["fixture_records.other"]
  const current = new Map([
    ["001.sql", "-- service-owner: records-owner\n" +
      "create index parent_idx on fixture_records.items(id);"],
    ["002.sql", "-- service-owner: records-actor\n" +
      "create index child_idx on fixture_records.other(id);"],
    ["003.sql", "-- service-owner: records-owner\n" +
      "alter index fixture_records.parent_idx attach partition fixture_records.child_idx;"],
  ])
  const findings = findNewMigrationAuthorityViolations(new Map(), current, [owner, actor])
  assert.match(findings.join("\n"), /cannot mutate index fixture_records\.child_idx/)
})

test("ignores CTE aliases that match a known relation name", () => {
  const owner = service("records-owner")
  owner.manifest.owned_dataset!.private_relations = ["fixture_records.deliveries"]
  const source = "-- service-owner: records-owner\n" +
    "with deliveries as (select 1) select * from deliveries;"
  assert.deepEqual(findNewMigrationAuthorityViolations(
    new Map(), new Map([["001.sql", source]]), [owner],
  ), [])
})
