import assert from "node:assert/strict"
import test from "node:test"

import { buildDatabaseSourceModules } from
  "../scripts/constitution/build_database_source_modules.ts"
import { findRuntimeAccessFindings } from
  "../scripts/constitution/find_runtime_access_findings.ts"
import { replayRelationDefinitions } from
  "../scripts/constitution/replay_relation_definitions.ts"
import { replayRoutineDefinitions } from
  "../scripts/constitution/replay_routine_definitions.ts"
import { service } from "./fixtures/service_constitution_fixture.ts"

test("keeps dependent view attribution after a relation rename", () => {
  const owner = service("records-owner")
  owner.manifest.owned_dataset!.private_relations = ["fixture_records.renamed"]
  const reader = service("records-reader")
  reader.manifest.owned_dataset!.private_relations = ["fixture_views.items_v1"]
  reader.manifest.owned_dataset!.private_routines = []
  const migrations = new Map([["001.sql", [
    "create table fixture_records.items(id bigint);",
    "create view fixture_views.items_v1 as select * from fixture_records.items;",
    "alter table fixture_records.items rename to renamed;",
  ].join("\n")]])
  const relations = replayRelationDefinitions(migrations)
  const modules = buildDatabaseSourceModules(
    [owner, reader], relations, new Map(),
  )
  const findings = findRuntimeAccessFindings([owner, reader], modules)
  assert.ok(findings.some((finding) =>
    finding.evidence.relation === "fixture_records.renamed"
  ))
})

test("keeps every statement in a BEGIN ATOMIC SQL routine body", () => {
  const owner = service("records-owner")
  owner.manifest.owned_dataset!.private_relations = [
    "fixture_records.items", "fixture_records.other",
  ]
  const reader = service("records-reader")
  reader.manifest.owned_dataset!.private_relations = []
  reader.manifest.owned_dataset!.private_routines = ["fixture_calls.read_all"]
  const migrations = new Map([["001.sql",
    "create function fixture_calls.read_all() returns bigint language sql " +
    "begin atomic select count(*) from fixture_records.items; " +
    "select count(*) from fixture_records.other; end;",
  ]])
  const routines = replayRoutineDefinitions(migrations)
  const modules = buildDatabaseSourceModules(
    [owner, reader], new Map(), routines,
  )
  const relations = new Set(findRuntimeAccessFindings([owner, reader], modules)
    .map((finding) => finding.evidence.relation))
  assert.ok(relations.has("fixture_records.items"))
  assert.ok(relations.has("fixture_records.other"))
})
