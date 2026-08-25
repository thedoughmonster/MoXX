import assert from "node:assert/strict"
import test from "node:test"

import type { AuthoritySnapshot } from
  "../scripts/constitution/load_target_authority_snapshot.ts"
import { findNewMigrationAuthorityViolations } from
  "../scripts/migrations/find_new_migration_authority_violations.ts"
import { service } from "./fixtures/service_constitution_fixture.ts"

test("the former owner cannot mutate a same-change relation transfer", () => {
  const former = service("records-owner")
  const next = service("records-next")
  former.manifest.owned_dataset!.private_relations = []
  next.manifest.owned_dataset!.private_relations = ["fixture_records.items"]
  const trusted: AuthoritySnapshot = {
    relationOwners: new Map([["fixture_records.items", "records-owner"]]),
    routineOwners: new Map(),
    schemaOwners: new Map([["fixture_records", new Set(["records-owner"])]]),
  }
  const findings = findNewMigrationAuthorityViolations(
    new Map(),
    new Map([["001.sql", "-- service-owner: records-owner\n" +
      "alter table fixture_records.items add column hidden text;"]]),
    [former, next],
    trusted,
  )
  assert.match(findings.join("\n"), /cannot mutate fixture_records\.items while ownership transfers/)
})

test("the former owner cannot mutate a same-change routine transfer", () => {
  const former = service("routine-owner")
  const next = service("routine-next")
  former.manifest.owned_dataset!.private_routines = []
  next.manifest.owned_dataset!.private_routines = ["fixture_records.mutate"]
  const trusted: AuthoritySnapshot = {
    relationOwners: new Map(),
    routineOwners: new Map([["fixture_records.mutate", "routine-owner"]]),
    schemaOwners: new Map([["fixture_records", new Set(["routine-owner"])]]),
  }
  const source = "-- service-owner: routine-owner\n" +
    "create or replace function fixture_records.mutate() " +
    "returns bigint language sql as 'select 1';"
  const findings = findNewMigrationAuthorityViolations(
    new Map(), new Map([["001.sql", source]]), [former, next], trusted,
  )
  assert.match(findings.join("\n"), /cannot mutate fixture_records\.mutate while ownership transfers/)
})
