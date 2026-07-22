import assert from "node:assert/strict"
import test from "node:test"

import { findNewMigrationAuthorityViolations } from
  "../scripts/migrations/find_new_migration_authority_violations.ts"
import { service } from "./fixtures/service_constitution_fixture.ts"

test("allows only the declared dynamic-read runtime execute ceremony", () => {
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
set role svc_records_consumer;
grant execute on function fixture_records.read_v1(text) to postgres;
reset role;
grant svc_records_consumer to postgres with inherit false, set false;`
  assert.deepEqual(findNewMigrationAuthorityViolations(
    new Map(), new Map([["001.sql", source]]), [owner],
  ), [])
  assert.match(findNewMigrationAuthorityViolations(
    new Map(), new Map([["001.sql", source.replace("to postgres;", "to public;")]]),
    [owner],
  ).join("\n"), /role and ownership authority is not yet modeled/u)
})
