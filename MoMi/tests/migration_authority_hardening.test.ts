import assert from "node:assert/strict"
import test from "node:test"

import { findNewMigrationAuthorityViolations } from
  "../scripts/migrations/find_new_migration_authority_violations.ts"
import { service } from "./fixtures/service_constitution_fixture.ts"

test("rejects quoted, spaced, and inline dynamic cross-owner SQL", () => {
  const owner = service("records-owner")
  const consumer = service("records-consumer")
  delete consumer.manifest.owned_dataset
  consumer.manifest.service_type = "read_facade"
  const header = "-- service-owner: records-consumer\n"
  for (const sql of [
    'delete from "fixture_records"."items"',
    "delete from fixture_records . items",
    "delete from fixture_records -- split\n . items",
    "delete /* split */ from fixture_records.items",
    "alter table only fixture_records.items add column hidden text",
    'delete from U&"fixture_records".U&"items"',
    "do $$ begin execute format('delete from %I', target); end $$",
  ]) assert.ok(findNewMigrationAuthorityViolations(
    new Map(), new Map([["001.sql", header + sql]]), [owner, consumer],
  ).length > 0)
})

test("rejects public-view grants, triggers, and rules", () => {
  const owner = service("records-owner")
  const consumer = service("records-consumer")
  delete consumer.manifest.owned_dataset
  consumer.manifest.service_type = "read_facade"
  const contract = "fixture.records.read.v1"
  owner.manifest.owned_dataset!.private_relations = ["fixture_records.items_v1"]
  owner.manifest.owned_dataset!.public_relation_reads = [{
    contract,
    relation: "fixture_records.items_v1",
  }]
  consumer.manifest.contracts.consumes = [{ service: "records-owner", contract }]
  const header = "-- service-owner: records-consumer\n"
  for (const sql of [
    "grant all on fixture_records.items_v1 to public",
    "revoke select on fixture_records.items_v1 from public",
    "create trigger changed before insert on fixture_records.items_v1 execute function x()",
    "create rule changed as on insert to fixture_records.items_v1 do instead nothing",
    "drop view public.other_v1, fixture_records.items_v1",
    "grant select on table public.other_v1, fixture_records.items_v1 to public",
  ]) assert.ok(findNewMigrationAuthorityViolations(
    new Map(), new Map([["001.sql", header + sql]]), [owner, consumer],
  ).length > 0)
})

test("rejects routine mutation and schema-wide authority changes", () => {
  const owner = service("records-owner")
  const consumer = service("records-consumer")
  delete consumer.manifest.owned_dataset
  consumer.manifest.service_type = "read_facade"
  const contract = "fixture.records.command.v1"
  owner.manifest.owned_dataset!.public_commands = [contract]
  owner.manifest.owned_dataset!.public_routine_commands = [{
    contract,
    routine: "fixture_records.mutate",
  }]
  consumer.manifest.contracts.consumes = [{ service: "records-owner", contract }]
  const header = "-- service-owner: records-consumer\n"
  for (const sql of [
    "drop function fixture_records.mutate(integer)",
    "drop function fixture_records.mutate",
    "drop function public.noop, fixture_records.mutate",
    "drop function fixture_records.mutate /* gap */ (integer)",
    "drop /* gap */ function fixture_records.mutate",
    "grant execute on function fixture_records.mutate(integer) to public",
    "grant select on all tables in schema fixture_records to public",
    "set search_path = fixture_records; select mutate(1)",
    "set schema 'fixture_records'; select mutate(1)",
    "drop schema public, fixture_records cascade",
  ]) assert.ok(findNewMigrationAuthorityViolations(
    new Map(), new Map([["001.sql", header + sql]]), [owner, consumer],
  ).length > 0)
})

test("does not confuse declarative EXECUTE syntax with dynamic SQL", () => {
  const owner = service("records-owner")
  const header = "-- service-owner: records-owner\n"
  for (const sql of [
    "create trigger changed before insert on fixture_records.items " +
      "for each row execute function fixture_records.mutate()",
    "grant execute on function fixture_records.mutate(integer) to public",
  ]) assert.ok(!findNewMigrationAuthorityViolations(
    new Map(), new Map([["001.sql", header + sql + ";"]]), [owner],
  ).some((item) => item.includes("dynamic SQL")))
})
