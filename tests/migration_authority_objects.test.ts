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

test("allows only the exact declared least-privilege non-login role", () => {
  const owner = service("records-owner")
  owner.manifest.owned_dataset!.db_role = "svc_records_owner"
  const header = "-- service-owner: records-owner\n"
  const safe = "create role svc_records_owner nologin noinherit nosuperuser " +
    "nocreatedb nocreaterole noreplication nobypassrls;"
  assert.deepEqual(findNewMigrationAuthorityViolations(
    new Map(), new Map([["001.sql", header + safe]]), [owner],
  ), [])
  const unsafe = safe.replace("nologin", "login")
  assert.match(findNewMigrationAuthorityViolations(
    new Map(), new Map([["001.sql", header + unsafe]]), [owner],
  ).join("\n"), /role and ownership authority is not yet modeled/u)
})

test("allows only the declared dynamic-read owner binding ceremony", () => {
  const owner = service("records-owner")
  owner.manifest.owned_dataset!.private_routines = ["fixture_records.read_v1"]
  owner.manifest.owned_dataset!.dynamic_read_routines = [{
    contract: "fixture.records.read.v1",
    routine: "fixture_records.read_v1",
    consumer_service: "records-consumer",
    role: "svc_records_consumer",
    schema: "fixture_records",
  }]
  const source = `-- service-owner: records-owner
grant svc_records_consumer to postgres with inherit false, set true;
grant create on schema fixture_records to svc_records_consumer;
alter function fixture_records.read_v1(text) security definer;
alter function fixture_records.read_v1(text) owner to svc_records_consumer;
revoke create on schema fixture_records from svc_records_consumer;
grant svc_records_consumer to postgres with inherit false, set false;`
  assert.deepEqual(findNewMigrationAuthorityViolations(
    new Map(), new Map([["001.sql", source]]), [owner],
  ), [])
  assert.match(findNewMigrationAuthorityViolations(
    new Map(), new Map([["001.sql", source.replace("set false", "set true")]]), [owner],
  ).join("\n"), /role and ownership authority is not yet modeled/u)
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
